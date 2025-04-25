// messageService.js - Converted from message.ts
import { decodeStreamMessage } from './utils';

// Message Status Enum
export const MessageStatus = {
  IN_PROGRESS: 0,
  END: 1,
  INTERRUPTED: 2
};

// Message Engine Mode Enum
export const MessageEngineMode = {
  TEXT: 'text',
  WORD: 'word',
  AUTO: 'auto'
};

// Transcription Object Type Enum
export const TranscriptionObjectType = {
  USER_TRANSCRIPTION: 'user.transcription',
  AGENT_TRANSCRIPTION: 'assistant.transcription',
  MSG_INTERRUPTED: 'message.interrupt'
};

// Default configurations
const DEFAULT_MESSAGE_CACHE_TIMEOUT = 1000 * 60 * 5; // 5 minutes
const DEFAULT_INTERVAL = 200; // milliseconds
const CONSOLE_LOG_PREFIX = '[MessageService]';

/**
 * Message engine that handles real-time transcription and subtitle rendering
 */
export class MessageEngine {
  constructor(rtcEngine, renderMode, callback) {
    // Private properties
    this._messageCache = {};
    this._messageCacheTimeout = DEFAULT_MESSAGE_CACHE_TIMEOUT;
    this._legacyMode = false;
    this._mode = MessageEngineMode.AUTO;
    this._queue = [];
    this._interval = DEFAULT_INTERVAL;
    this._intervalRef = null;
    this._pts = 0;
    this._lastPoppedQueueItem = null;
    this._isRunning = false;
    this._rtcEngine = rtcEngine;

    // Public properties
    this.messageList = [];
    this.onMessageListUpdate = callback || null;

    // Initialize
    this._rtcEngine = rtcEngine;
    this._listenRtcEvents();
    this.run({ legacyMode: false });
    this.setMode(renderMode || MessageEngineMode.AUTO);
  }

  _listenRtcEvents() {
    if (!this._rtcEngine) {
      return;
    }
    
    this._rtcEngine.on('audio-metadata', (metadata) => {
      const pts64 = Number(new DataView(metadata.buffer).getBigUint64(0, true));
      this.setPts(pts64);
    });

    this._rtcEngine.on('stream-message', (_, payload) => {
      this.handleStreamMessage(payload);
    });
  }

  run(options = {}) {
    this._isRunning = true;
    this._legacyMode = options.legacyMode || false;
  }

  setupInterval() {
    if (!this._isRunning) {
      console.error(CONSOLE_LOG_PREFIX, 'Message service is not running');
      return;
    }
    
    if (this._intervalRef) {
      clearInterval(this._intervalRef);
      this._intervalRef = null;
    }
    
    this._intervalRef = setInterval(
      this._handleQueue.bind(this),
      this._interval
    );
  }

  teardownInterval() {
    if (this._intervalRef) {
      clearInterval(this._intervalRef);
      this._intervalRef = null;
    }
  }

  setPts(pts) {
    if (this._pts < pts) {
      this._pts = pts;
    }
  }

  handleStreamMessage(stream) {
    if (!this._isRunning) {
      console.warn(CONSOLE_LOG_PREFIX, 'Message service WAS not running');
      this._isRunning = true
      //return;
    }
    
    const chunk = this.streamMessage2Chunk(stream);
    
    if (this._legacyMode) {
      this.handleChunk(chunk, this.handleMessageLegacy.bind(this));
      return;
    }
    
    this.handleChunk(chunk, this.handleMessage.bind(this));
  }

  // Legacy message handler for backward compatibility
  handleMessageLegacy(message) {
    const isTextValid = message?.text && message.text?.trim().length > 0;
    if (!isTextValid) {
      console.debug(
        CONSOLE_LOG_PREFIX,
        '[handleMessageLegacy]',
        'Drop message with empty text',
        message
      );
      return;
    }
    
    const lastEndedItem = this.messageList.findLast(
      (item) =>
        item.uid === message.stream_id && item.status === MessageStatus.END
    );
    
    const lastInProgressItem = this.messageList.findLast(
      (item) =>
        item.uid === message.stream_id &&
        item.status === MessageStatus.IN_PROGRESS
    );
    
    if (lastEndedItem) {
      console.debug(
        CONSOLE_LOG_PREFIX,
        '[handleMessageLegacy]',
        'lastEndedItem',
        JSON.stringify(lastEndedItem)
      );
      
      if (lastEndedItem._time >= message.text_ts) {
        console.debug(
          CONSOLE_LOG_PREFIX,
          '[handleMessageLegacy] discard lastEndedItem'
        );
        return;
      } else {
        if (lastInProgressItem) {
          console.debug(
            CONSOLE_LOG_PREFIX,
            '[handleMessageLegacy] update lastInProgressItem'
          );
          lastInProgressItem._time = message.text_ts;
          lastInProgressItem.text = message.text;
          lastInProgressItem.status = message.is_final
            ? MessageStatus.END
            : MessageStatus.IN_PROGRESS;
        } else {
          console.debug(
            CONSOLE_LOG_PREFIX,
            '[handleMessageLegacy] append new item'
          );
          this._appendChatHistory({
            uid: message.stream_id,
            turn_id: message.text_ts,
            _time: message.text_ts,
            text: message.text,
            status: message.is_final
              ? MessageStatus.END
              : MessageStatus.IN_PROGRESS,
            metadata: null,
          });
        }
      }
    } else {
      if (lastInProgressItem) {
        console.debug(
          CONSOLE_LOG_PREFIX,
          '[handleMessageLegacy] update lastInProgressItem'
        );
        lastInProgressItem._time = message.text_ts;
        lastInProgressItem.text = message.text;
        lastInProgressItem.status = message.is_final
          ? MessageStatus.END
          : MessageStatus.IN_PROGRESS;
      } else {
        console.debug(
          CONSOLE_LOG_PREFIX,
          '[handleMessageLegacy] append new item'
        );
        this._appendChatHistory({
          uid: message.stream_id,
          turn_id: message.text_ts,
          _time: message.text_ts,
          text: message.text,
          status: message.is_final
            ? MessageStatus.END
            : MessageStatus.IN_PROGRESS,
          metadata: null,
        });
      }
    }
    
    this.messageList.sort((a, b) => a._time - b._time);
    this._mutateChatHistory();
  }

  handleMessage(message) {
    // Check message type
    const isAgentMessage =
      message.object === TranscriptionObjectType.AGENT_TRANSCRIPTION;
    const isUserMessage =
      message.object === TranscriptionObjectType.USER_TRANSCRIPTION;
    const isMessageInterrupt =
      message.object === TranscriptionObjectType.MSG_INTERRUPTED;
      
    if (!isAgentMessage && !isUserMessage && !isMessageInterrupt) {
      console.debug(CONSOLE_LOG_PREFIX, 'Unknown message type', message);
      return;
    }
    
    // Set mode (only once)
    if (isAgentMessage && this._mode === MessageEngineMode.AUTO) {
      // Check if words is empty, and set mode
      if (!message.words) {
        this.setMode(MessageEngineMode.TEXT);
      } else {
        this.setupInterval();
        this.setMode(MessageEngineMode.WORD);
      }
    }
    
    // Handle Agent Message
    if (isAgentMessage && this._mode === MessageEngineMode.WORD) {
      this.handleWordAgentMessage(message);
      return;
    }
    
    if (isAgentMessage && this._mode === MessageEngineMode.TEXT) {
      this.handleTextMessage(message);
      return;
    }
    
    // Handle User Message
    if (isUserMessage) {
      this.handleTextMessage(message);
      return;
    }
    
    // Handle Message Interrupt
    if (isMessageInterrupt) {
      this.handleMessageInterrupt(message);
      return;
    }
    
    // Unknown mode
    console.error(CONSOLE_LOG_PREFIX, 'Unknown mode', message);
  }

  handleTextMessage(message) {
    const turn_id = message.turn_id;
    const text = message.text || '';
    const stream_id = message.stream_id;
    const turn_status = MessageStatus.END;

    const targetChatHistoryItem = this.messageList.find(
      (item) => item.turn_id === turn_id && item.uid === stream_id
    );
    
    // If not found, push to messageList
    if (!targetChatHistoryItem) {
      this._appendChatHistory({
        turn_id,
        uid: stream_id,
        _time: new Date().getTime(),
        text,
        status: turn_status,
        metadata: message,
      });
    } else {
      // If found, update text and status
      targetChatHistoryItem.text = text;
      targetChatHistoryItem.status = turn_status;
      targetChatHistoryItem.metadata = message;
    }
    
    this._mutateChatHistory();
  }

  handleMessageInterrupt(message) {
    console.debug(CONSOLE_LOG_PREFIX, 'handleMessageInterrupt', message);
    const turn_id = message.turn_id;
    const start_ms = message.start_ms;
    
    this._interruptQueue({
      turn_id,
      start_ms,
    });
    
    this._mutateChatHistory();
  }

  handleWordAgentMessage(message) {
    // Drop message if turn_status is undefined
    if (typeof message.turn_status === 'undefined') {
      console.debug(
        CONSOLE_LOG_PREFIX,
        'Drop message with undefined turn_status',
        message
      );
      return;
    }

    console.debug(
      CONSOLE_LOG_PREFIX,
      'handleWordAgentMessage',
      JSON.stringify(message)
    );

    const turn_id = message.turn_id;
    const text = message.text || '';
    const words = message.words || [];
    const stream_id = message.stream_id;
    const lastPoppedQueueItemTurnId = this._lastPoppedQueueItem?.turn_id;
    
    // Drop message if turn_id is less than last popped queue item
    // except for the first turn (greeting message, turn_id is 0)
    if (
      lastPoppedQueueItemTurnId &&
      turn_id !== 0 &&
      turn_id <= lastPoppedQueueItemTurnId
    ) {
      console.debug(
        CONSOLE_LOG_PREFIX,
        'Drop message with turn_id less than last popped queue item',
        message
      );
      return;
    }
    
    this._pushToQueue({
      turn_id,
      words,
      text,
      status: message.turn_status,
      stream_id,
    });
  }

  sortWordsWithStatus(words, turn_status) {
    if (words.length === 0) {
      return words;
    }
    
    const sortedWords = words
      .map((word) => ({
        ...word,
        word_status: MessageStatus.IN_PROGRESS,
      }))
      .sort((a, b) => a.start_ms - b.start_ms)
      .reduce((acc, curr) => {
        // Only add if start_ms is unique
        if (!acc.find((word) => word.start_ms === curr.start_ms)) {
          acc.push(curr);
        }
        return acc;
      }, []);
      
    const isMessageFinal = turn_status !== MessageStatus.IN_PROGRESS;
    if (isMessageFinal) {
      sortedWords[sortedWords.length - 1].word_status = turn_status;
    }
    
    return sortedWords;
  }

  setMode(mode) {
    if (this._mode !== MessageEngineMode.AUTO) {
      console.warn(
        CONSOLE_LOG_PREFIX,
        'Mode should only be set once, but it is set again',
        'current mode:',
        this._mode
      );
      return;
    }
    
    if (mode === MessageEngineMode.AUTO) {
      console.warn(
        CONSOLE_LOG_PREFIX,
        'Unknown mode should not be set again',
        'current mode:',
        this._mode
      );
      return;
    }
    
    this._mode = mode;
  }

  cleanMessageCache() {
    this._messageCache = {};
  }

  cleanup() {
    console.debug(CONSOLE_LOG_PREFIX, 'Cleanup message service');
    this._isRunning = false;
    this._legacyMode = false;
    
    // Clean up message cache
    this.cleanMessageCache();
    
    // Teardown interval
    this.teardownInterval();
    
    // Clean up queue
    this._queue = [];
    this._lastPoppedQueueItem = null;
    this._pts = 0;
    
    // Clean up messageList
    this.messageList = [];
    
    // Clean up mode
    this._mode = MessageEngineMode.AUTO;
  }

  // Utils: Uint8Array -> string
  streamMessage2Chunk(stream) {
    return decodeStreamMessage(stream);
  }

  /**
   * Handle a chunk of data from a stream message
   * @param {string} chunk - String format: {message_id}|{part_idx}|{part_sum}|{part_data}
   * @param {Function} callback - Callback function to process the complete message
   */
  handleChunk(chunk, callback) {
    try {
      // Split chunk by '|'
      const [msgId, partIdx, partSum, partData] = chunk.split('|');
      
      // Convert to data chunk
      const input = {
        message_id: msgId,
        part_idx: parseInt(partIdx, 10),
        part_sum: partSum === '???' ? -1 : parseInt(partSum, 10), // -1 means total parts unknown
        content: partData,
      };
      
      // Check if total parts is known, skip if unknown
      if (input.part_sum === -1) {
        console.debug(
          CONSOLE_LOG_PREFIX,
          'total parts unknown, waiting for further parts.'
        );
        return;
      }

      // Check if cached
      // Case 1: not cached, create new cache
      if (!this._messageCache[input.message_id]) {
        this._messageCache[input.message_id] = [];
        
        // Set cache timeout, drop it if incomplete after timeout
        setTimeout(() => {
          if (
            this._messageCache[input.message_id] &&
            this._messageCache[input.message_id].length < input.part_sum
          ) {
            console.debug(
              CONSOLE_LOG_PREFIX,
              input.message_id,
              'message cache timeout, drop it.'
            );
            delete this._messageCache[input.message_id];
          }
        }, this._messageCacheTimeout);
      }
      
      // Case 2: cached, add to cache (and sort by part_idx)
      if (
        !this._messageCache[input.message_id]?.find(
          (item) => item.part_idx === input.part_idx
        )
      ) {
        // Unique push
        this._messageCache[input.message_id].push(input);
      }
      
      this._messageCache[input.message_id].sort(
        (a, b) => a.part_idx - b.part_idx
      );

      // Check if complete
      if (this._messageCache[input.message_id].length === input.part_sum) {
        const message = this._messageCache[input.message_id]
          .map((chunk) => chunk.content)
          .join('');

        // Decode message
        console.debug(CONSOLE_LOG_PREFIX, '[message]', atob(message));

        const decodedMessage = JSON.parse(atob(message));

        console.debug(CONSOLE_LOG_PREFIX, '[decodedMessage]', decodedMessage);

        // Callback
        callback?.(decodedMessage);

        // Delete cache
        delete this._messageCache[input.message_id];
      }
    } catch (error) {
      console.error(CONSOLE_LOG_PREFIX, 'handleChunk error', error);
      return;
    }
  }

  _pushToQueue(data) {
    const targetQueueItem = this._queue.find(
      (item) => item.turn_id === data.turn_id
    );
    
    const latestTurnId = this._queue.reduce((max, item) => {
      return Math.max(max, item.turn_id);
    }, 0);
    
    // If not found, push to queue or drop if turn_id is less than latestTurnId
    if (!targetQueueItem) {
      // Drop if turn_id is less than latestTurnId
      if (data.turn_id < latestTurnId) {
        console.debug(
          CONSOLE_LOG_PREFIX,
          'Drop message with turn_id less than latestTurnId',
          data
        );
        return;
      }
      
      const newQueueItem = {
        turn_id: data.turn_id,
        text: data.text,
        words: this.sortWordsWithStatus(data.words, data.status),
        status: data.status,
        stream_id: data.stream_id,
      };
      
      console.debug(
        CONSOLE_LOG_PREFIX,
        'Push to queue',
        newQueueItem,
        JSON.stringify(newQueueItem)
      );
      
      // Push to queue
      this._queue.push(newQueueItem);
      return;
    }
    
    // If found, update text, words (sorted with status) and turn_status
    console.debug(
      CONSOLE_LOG_PREFIX,
      'Update queue item',
      JSON.stringify(targetQueueItem),
      JSON.stringify(data)
    );
    
    targetQueueItem.text = data.text;
    targetQueueItem.words = this.sortWordsWithStatus(
      [...targetQueueItem.words, ...data.words],
      data.status
    );
    
    // If targetQueueItem.status is end, and data.status is in_progress, skip status update (unexpected case)
    if (
      targetQueueItem.status !== MessageStatus.IN_PROGRESS &&
      data.status === MessageStatus.IN_PROGRESS
    ) {
      return;
    }
    
    targetQueueItem.status = data.status;
  }

// Replace the _handleQueue function in messageService.js with this:

_handleQueue() {
    const queueLength = this._queue.length;
    
    // Empty queue, skip
    if (queueLength === 0) {
      return;
    }
    
    const curPTS = this._pts;
    
    // Only one item, update messageList with queueItem
    if (queueLength === 1) {
      console.debug(
        CONSOLE_LOG_PREFIX,
        `Processing single queue item (turn_id: ${this._queue[0].turn_id})`
      );
      
      const queueItem = this._queue[0];
      this._handleTurnObj(queueItem, curPTS);
      this._mutateChatHistory();
      return;
    }
    
    if (queueLength > 2) {
      console.debug(
        CONSOLE_LOG_PREFIX,
        'Queue length is greater than 2, but handling it anyway'
      );
      // Process all items in the queue independently without interrupting older ones
      this._queue.forEach(queueItem => {
        this._handleTurnObj(queueItem, curPTS);
      });
      this._mutateChatHistory();
      return;
    }
    
    // For queueLength == 2, don't automatically mark the older one as interrupted
    if (queueLength === 2) {
      // Sort queue by turn_id
      this._queue = this._queue.sort((a, b) => a.turn_id - b.turn_id);
      
      // Process both items without interrupting
      this._queue.forEach(queueItem => {
        this._handleTurnObj(queueItem, curPTS);
      });
      
      // Remove finished items
      this._queue = this._queue.filter(item => 
        item.status === MessageStatus.IN_PROGRESS
      );
      
      this._mutateChatHistory();
      return;
    }
  }

  _interruptQueue(options) {
    const turn_id = options.turn_id;
    const start_ms = options.start_ms;
    
    const correspondingQueueItem = this._queue.find(
      (item) => item.turn_id === turn_id
    );
    
    if (!correspondingQueueItem) {
      console.debug(
        CONSOLE_LOG_PREFIX,
        'No corresponding queue item found',
        options
      );
      return;
    }
    
    // If correspondingQueueItem exists, update its status to interrupted
    correspondingQueueItem.status = MessageStatus.INTERRUPTED;
    
    // Split words into two parts, set left one word and all right words to interrupted
    const leftWords = correspondingQueueItem.words.filter(
      (word) => word.start_ms <= start_ms
    );
    
    const rightWords = correspondingQueueItem.words.filter(
      (word) => word.start_ms > start_ms
    );
    
    // Check if leftWords is empty
    const isLeftWordsEmpty = leftWords.length === 0;
    
    if (isLeftWordsEmpty) {
      // If leftWords is empty, set all words to interrupted
      correspondingQueueItem.words.forEach((word) => {
        word.word_status = MessageStatus.INTERRUPTED;
      });
    } else {
      // If leftWords is not empty, set leftWords[leftWords.length - 1].word_status to interrupted
      leftWords[leftWords.length - 1].word_status = MessageStatus.INTERRUPTED;
      
      // And all right words to interrupted
      rightWords.forEach((word) => {
        word.word_status = MessageStatus.INTERRUPTED;
      });
      
      // Update words
      correspondingQueueItem.words = [...leftWords, ...rightWords];
    }
  }
// Replace the _handleTurnObj function in messageService.js with this:

_handleTurnObj(queueItem, curPTS) {
    let correspondingChatHistoryItem = this.messageList.find(
      (item) =>
        item.turn_id === queueItem.turn_id && item.uid === queueItem.stream_id
    );
    
    // Simplified logging - just basic info
    console.debug(
      CONSOLE_LOG_PREFIX,
      `Processing turn ${queueItem.turn_id} (status: ${queueItem.status})`
    );
    
    if (!correspondingChatHistoryItem) {
      correspondingChatHistoryItem = {
        turn_id: queueItem.turn_id,
        uid: queueItem.stream_id,
        _time: new Date().getTime(),
        text: queueItem.text || '', // Use the text from queueItem immediately
        status: queueItem.status,
        metadata: queueItem,
      };
      
      this._appendChatHistory(correspondingChatHistoryItem);
    }
    
    // Update correspondingChatHistoryItem._time for chatHistory auto-scroll
    correspondingChatHistoryItem._time = new Date().getTime();
    
    // Update correspondingChatHistoryItem.metadata
    correspondingChatHistoryItem.metadata = queueItem;
    
    // Update correspondingChatHistoryItem.status if queueItem.status is interrupted
    if (queueItem.status === MessageStatus.INTERRUPTED) {
      correspondingChatHistoryItem.status = MessageStatus.INTERRUPTED;
    }
    
    // Pop all valid word items (those word.start_ms <= curPTS) in queueItem
    const validWords = [];
    const restWords = [];
    
    for (const word of queueItem.words) {
      if (word.start_ms <= curPTS) {
        validWords.push(word);
      } else {
        restWords.push(word);
      }
    }
    
    // Check if restWords is empty
    const isRestWordsEmpty = restWords.length === 0;
    
    // Check if validWords last word is final
    const isLastWordFinal =
      validWords[validWords.length - 1]?.word_status !==
      MessageStatus.IN_PROGRESS;
      
    // If restWords is empty and validWords last word is final, this turn is ended
    if (isRestWordsEmpty && isLastWordFinal) {
      // Update messageList with queueItem
      correspondingChatHistoryItem.text = queueItem.text;
      correspondingChatHistoryItem.status = queueItem.status;
      
      // Pop queueItem
      this._lastPoppedQueueItem = this._queue.shift();
      return;
    }
    
    // If restWords is not empty, update correspondingChatHistoryItem.text
    const validWordsText = validWords
      .filter((word) => word.word_status === MessageStatus.IN_PROGRESS)
      .map((word) => word.word)
      .join('');
      
    // Use validWordsText if not empty, otherwise keep the original text or use queueItem.text
    if (validWordsText && validWordsText.trim().length > 0) {
      correspondingChatHistoryItem.text = validWordsText;
    } else if (queueItem.text && queueItem.text.trim().length > 0) {
      correspondingChatHistoryItem.text = queueItem.text;
    }
    
    // If validWords last word is interrupted, this turn is ended
    const isLastWordInterrupted =
      validWords[validWords.length - 1]?.word_status ===
      MessageStatus.INTERRUPTED;
      
    if (isLastWordInterrupted) {
      // Pop queueItem
      this._lastPoppedQueueItem = this._queue.shift();
      return;
    }
    
    return;
  }

  _appendChatHistory(item) {
    // If item.turn_id is 0, append to the front of messageList (greeting message)
    if (item.turn_id === 0) {
      this.messageList = [item, ...this.messageList];
    } else {
      this.messageList.push(item);
    }
  }

  _mutateChatHistory() {
    // Simplified logging - just count of messages
    console.debug(
      CONSOLE_LOG_PREFIX,
      `Updated message list (${this.messageList.length} messages)`
    );
    
    this.onMessageListUpdate?.(this.messageList);
  }
}
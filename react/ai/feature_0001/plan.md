# Chat Experience Improvements - Implementation Plan

## Analysis Summary

After analyzing the current chat implementation, I've identified the root causes of the three issues:

### Current Architecture
- **RtmChatPanel.js**: Main chat component handling RTM messages and subtitles
- **processRtmMessage()**: Filters and processes messages, including `<trl-` commands
- **sanitizeCommandMessage()**: Strips `<trl-` tags from messages in `trulienceUtils.js`
- **Message states**: `pendingRtmMessages`, `liveSubtitles`, `preservedSubtitleMessages`, `combinedMessages`
- **Connection states**: Tracks when user connects/disconnects from calls

### Root Causes Identified

1. **Welcome Message Issue**: Agent's first messages not displayed on reconnect
   - Location: RtmChatPanel.js lines 123-148 (disconnect handling)
   - When reconnecting, we miss the agent's initial greeting/welcome messages
   - This happens because message processing starts after connection is established
   - The agent sends welcome messages immediately upon connection, but they may not be captured

2. **Raw `<trl-` Tags Issue**: Inconsistent tag processing
   - Location: RtmChatPanel.js lines 597, 424 (`sanitizeCommandMessage` calls)
   - Tags processed for live subtitles but may slip through in RTM messages
   - processRtmMessage() at line 21 processes commands but doesn't always sanitize display text

3. **Chat History Persistence Issue**: Messages cleared on disconnect
   - Location: RtmChatPanel.js lines 123-148 (disconnect handling)
   - `preservedSubtitleMessages` works but `pendingRtmMessages` is cleared
   - No session-level persistence across connect/disconnect cycles

## Implementation Plan

### Phase 1: Fix Raw Tag Display (Highest Priority)
**Files to modify**: `src/components/RtmChatPanel.js`

1. **Enhance processRtmMessage function** (lines 13-39)
   - Always apply `sanitizeCommandMessage()` to display text
   - Ensure both command processing AND tag sanitization occur

2. **Add safety sanitization in render** (lines 748-849)
   - Apply `sanitizeCommandMessage()` as final safety check in `renderMessage()`
   - Prevent any `<trl-` tags from reaching the DOM

### Phase 2: Fix Agent First Messages on Reconnect
**Files to modify**: `src/components/RtmChatPanel.js`

1. **Investigate message timing issue**
   - Check if RTM listener is active before agent sends first messages
   - Ensure `handleRtmMessageCallback` is registered before connection completes

2. **Improve message capture timing**
   - Move RTM listener setup earlier in connection process (lines 698-706)
   - Ensure message processing starts before agent begins sending messages

3. **Add connection state tracking**
   - Track when we're in "initial connection" vs "reconnection" state
   - Potentially buffer early messages until UI is ready

4. **Debug message flow**
   - Add logging to understand when agent messages arrive vs when listener is active
   - Identify the timing gap causing missed welcome messages

### Phase 3: Improve Chat History Persistence
**Files to modify**: `src/components/RtmChatPanel.js`

1. **Create session-level message storage**
   - New state: `sessionMessages` - persists until page refresh
   - Store all user and agent messages across connections

2. **Update disconnect handling** (lines 123-148)
   - Preserve both RTM messages and subtitle messages
   - Merge with existing `preservedSubtitleMessages` logic

3. **Enhance message combination** (lines 498-667)
   - Include session messages in `combinedMessages`
   - Maintain chronological order across sessions

## Implementation Order

1. **Phase 1 (Tag Sanitization)** - Critical bug fix
   - Modify `processRtmMessage()`
   - Add sanitization in `renderMessage()`
   - Test with messages containing `<trl-` tags

2. **Phase 2 (Agent First Messages)** - User experience improvement
   - Debug and fix message timing on reconnect
   - Ensure RTM listener captures agent's initial messages
   - Test connect/disconnect/reconnect cycles

3. **Phase 3 (History Persistence)** - Enhanced functionality
   - Implement session storage
   - Update disconnect/reconnect handling
   - Test persistence across multiple sessions

## Investigation Focus for Phase 2

The key issue is timing:
- Agent connects and immediately sends welcome/greeting messages
- RTM listener may not be active yet, causing missed messages
- Need to ensure message capturing is ready before agent starts sending

This requires understanding the exact connection flow and when RTM messages start being sent by the agent.

## Testing Strategy

- **Manual Testing**: Connect/disconnect cycles with focus on first agent messages
- **Edge Cases**: Messages with multiple `<trl-` tags, rapid connect/disconnect
- **Timing Tests**: Verify agent's first messages are captured consistently
- **Browser Testing**: Verify session persistence works until page refresh
- **Integration Testing**: Ensure changes don't break existing chat functionality

## Risk Assessment

- **Low Risk**: Tag sanitization (isolated to display logic)
- **Medium Risk**: Message timing fixes (involves connection flow)
- **Medium Risk**: History persistence (involves state management changes)

All changes are contained within the chat component and utilities, minimizing system-wide impact.
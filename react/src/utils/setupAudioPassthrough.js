import logger from "./logger";

function setupPassthroughTransform(rtpEntity, direction = 'recv') {
  if (!rtpEntity) {
    logger.warn(`Passthrough setup skipped: RTCRtp${direction === 'send' ? 'Sender' : 'Receiver'} is missing.`);
    return;
  }

  if (rtpEntity.transform) {
    logger.log("Transform already exists, skipping setup.");
    return;
  }

  try {
    const streams = rtpEntity.createEncodedStreams();
    const readable = streams.readable;
    const writable = streams.writable;
    // Creating an identity transform stream
    readable.pipeThrough(new TransformStream()).pipeTo(writable);
    logger.log(`✅ Passthrough transform set up for ${direction === 'send' ? 'sender' : 'receiver'}.`);
  } catch (err) {
    logger.error(`❌ Error setting up ${direction} transform:`, err);
  }
}

function findRtpEntity(pc, direction, track) {
  const entities = direction === 'send' ? pc.getSenders() : pc.getReceivers();
  return entities.find(entity => entity.track && entity.track.id === track.id) || null;
}

export function setupAudioPassthrough(client, audioTrack, direction = 'recv') {
  if (!client || !audioTrack) {
    logger.warn("Passthrough setup skipped: Missing client or track.");
    return;
  }

  const pc = client._p2pChannel?.connection?.peerConnection;

  if (!pc) {
    logger.error("Could not access RTCPeerConnection from client.");
    logger.log("Debug info - client object:", client);
    return;
  }

  const mediaTrack = audioTrack.getMediaStreamTrack();

  if (!mediaTrack) {
    logger.warn("MediaStreamTrack not found.");
    return;
  }

  const rtpEntity = findRtpEntity(pc, direction, mediaTrack);
  if (!rtpEntity) {
    logger.error(`Could not find RTCRtp${direction === 'send' ? 'Sender' : 'Receiver'} for the audio track.`);
    return;
  }

  setupPassthroughTransform(rtpEntity, direction);
}

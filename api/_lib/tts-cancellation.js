// Closing a client response must stop its upstream TTS request and audio stream.
module.exports = function createTtsCancellation(req, res) {
  const controller = new AbortController();
  let stream;
  const cancel = () => {
    if (!res.writableEnded) {
      controller.abort();
      stream?.destroy();
    }
    cleanup();
  };
  const cleanup = () => {
    req.removeListener?.('aborted', cancel);
    res.removeListener?.('close', cancel);
    res.removeListener?.('finish', cleanup);
  };
  req.once?.('aborted', cancel);
  res.once?.('close', cancel);
  res.once?.('finish', cleanup);
  if (req.aborted || res.destroyed) cancel();
  return {
    signal: controller.signal,
    attach(value) {
      stream = value;
      if (controller.signal.aborted) stream?.destroy();
    }
  };
};

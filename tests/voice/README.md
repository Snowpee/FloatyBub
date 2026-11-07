# Voice regression checks

Run from the repository root:

```sh
node tests/voice/check-tts-models.cjs
```

The runtime suite uses isolated IndexedDB and React renderers. Install its optional dependencies in a temporary directory without changing application dependencies:

```sh
npm install --prefix /tmp/floaty-voice-tests --no-audit --no-fund fake-indexeddb react-test-renderer@18.3.1 react-dom@18.3.1
VOICE_TEST_MODULES=/tmp/floaty-voice-tests node tests/voice/check-voice-runtime.cjs
```

The tests mock upstream TTS requests and media decoding; they do not generate paid audio. They cover queue concurrency, request merging, cancellation, durable caches, new versus historical reply behavior, parameter-change confirmation, waveform persistence and long audio. Native iOS playback and actual upstream cancellation still require device integration testing.

import { useState } from 'react';

/** Keep existing spans stable so only newly streamed text fades into view. */
export default function VoiceMessageText({ text }: { text: string }) {
  const [display, setDisplay] = useState({ text, chunks: [text], revision: 0 });
  if (text !== display.text) {
    const appended = text.startsWith(display.text);
    setDisplay({
      text,
      chunks: appended ? [...display.chunks, text.slice(display.text.length)] : [text],
      revision: appended ? display.revision : display.revision + 1,
    });
  }
  return <p className="whitespace-pre-wrap break-words">
    {display.chunks.map((chunk, index) => <span
      key={`${display.revision}-${index}`}
      className="voice-text-reveal"
    >{chunk}</span>)}
  </p>;
}

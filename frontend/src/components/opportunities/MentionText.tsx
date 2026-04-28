import React from 'react';

interface MentionTextProps {
  text: string;
  className?: string;
}

const MENTION_REGEX = /@\[([^\]]+)\]\((\d+)\)/g;

const MentionText: React.FC<MentionTextProps> = ({ text, className }) => {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // Add the mention tag
    const displayName = match[1];
    parts.push(
      <span key={match.index} className="mention-tag">
        @{displayName}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <p className={className}>{parts}</p>;
};

export default MentionText;

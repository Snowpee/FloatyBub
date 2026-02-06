import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onLinkClick?: (href: string) => boolean | void;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '', onLinkClick }) => {
  return (
    <div className={`markdown-content text-wrap whitespace-normal break-word min-w-0 overflow-x-hidden ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // 自定义代码块样式
          code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            
            // 如果没有 className 且不是 inline，说明是未声明语言的代码块
            // react-markdown 会传入 inline 属性
            return !inline && match ? (
              <pre className="markdown-code-block border border-base-content/10 rounded-lg p-4 overflow-x-auto my-2 text-wrap break-word min-w-0">
                <code className={`${className} text-sm bg-transparent`} {...props}>
                  {children}
                </code>
              </pre>
            ) : !inline ? (
              // 处理未声明语言的代码块 (block code without language)
              <pre className="markdown-code-block border border-base-content/10 rounded-lg p-4 overflow-x-auto my-2 text-wrap break-word min-w-0">
                <code className="text-sm bg-transparent" {...props}>
                  {children}
                </code>
              </pre>
            ) : (
              <code
                className="bg-base-200 px-1.5 py-0.5 rounded text-sm font-mono text-base-content"
                {...props}
              >
                {children}
              </code>
            );
          },
          // 自定义链接样式
          a: ({ children, href, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline cursor-pointer"
              onClick={(e) => {
                if (href && onLinkClick) {
                  const handled = onLinkClick(href);
                  if (handled) {
                    e.preventDefault();
                  }
                  e.stopPropagation();
                }
              }}
              {...props}
            >
              {children}
            </a>
          ),
          // 自定义表格样式
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border border-base-content/20" {...props}>
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th
              className="border border-base-content/20 bg-base-200 px-4 py-2 text-left font-medium text-base-content"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="border border-base-content/20 px-4 py-2 text-base-content" {...props}>
              {children}
            </td>
          ),
          // 自定义引用块样式
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="border-l-4 border-base-content/30 pl-4 my-4 italic text-base-content/70"
              {...props}
            >
              {children}
            </blockquote>
          ),
          // 自定义标题样式
          h1: ({ children, ...props }) => (
            <h1 className="text-2xl font-bold mt-6 mb-4 text-base-content" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-xl font-bold mt-5 mb-3 text-base-content" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-lg font-bold mt-4 mb-2 text-base-content" {...props}>
              {children}
            </h3>
          ),
          // 自定义列表样式
          ul: ({ children, ...props }) => (
            <ul className="list-disc list-inside my-2 space-y-1" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal list-inside my-2 space-y-1" {...props}>
              {children}
            </ol>
          ),
          // 自定义段落样式
          p: ({ children, ...props }) => (
            <p className="my-2 leading-relaxed break-words overflow-wrap-anywhere" {...props}>
              {children}
            </p>
          ),
          // 自定义图片样式
          img: ({ src, alt, ...props }) => (
            <img
              src={src}
              alt={alt || '图片'}
              className="max-w-full h-auto rounded-lg shadow-md my-4 mx-auto block"
              loading="lazy"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;

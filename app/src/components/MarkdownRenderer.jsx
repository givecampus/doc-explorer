import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Link } from 'react-router-dom';

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function headingText(children) {
  return React.Children.toArray(children)
    .map((child) => (typeof child === 'string' ? child : headingText(child?.props?.children ?? '')))
    .join('');
}

function makeHeading(Tag) {
  return function Heading({ children, ...rest }) {
    const id = slugify(headingText(children));
    return <Tag id={id} {...rest}>{children}</Tag>;
  };
}

function resolveRoute(currentDir, href) {
  const parts = (currentDir + '/' + href).split('/');
  const resolved = [];
  for (const p of parts) {
    if (p === '.' || p === '') continue;
    if (p === '..') resolved.pop();
    else resolved.push(p);
  }
  return '/' + resolved.join('/');
}

function isExternal(href) {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('mailto:');
}

export default function MarkdownRenderer({ content, currentRoute }) {
  const currentDir = currentRoute
    ? currentRoute.replace(/\/[^/]*$/, '') || '/'
    : '/';

  const components = {
    h2: makeHeading('h2'),
    h3: makeHeading('h3'),
    h4: makeHeading('h4'),
    a({ href, children, ...rest }) {
      if (!href || href.startsWith('#')) {
        return <a href={href} {...rest}>{children}</a>;
      }
      if (isExternal(href)) {
        return <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>{children}</a>;
      }
      const to = resolveRoute(currentDir, href);
      return <Link to={to} {...rest}>{children}</Link>;
    },
  };

  return (
    <div className="markdown-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

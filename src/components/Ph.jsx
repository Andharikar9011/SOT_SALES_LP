import { isPlaceholder } from '../utils/text.js';

// Renders a content string. In dev, values containing [PLACEHOLDER] get a data attribute (dotted underline).
// In production the string is rendered untouched.
export default function Ph({ v, as: Tag = 'span', ...rest }) {
  const flag = import.meta.env.DEV && isPlaceholder(v);
  return <Tag {...rest} {...(flag ? { 'data-placeholder': '' } : {})}>{v}</Tag>;
}

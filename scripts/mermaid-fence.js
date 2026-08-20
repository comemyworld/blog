/**
 * Hexo 构建期过滤器：把 ` ```mermaid ` 围栏代码块转换成 Butterfly 前端 codeToMermaid()
 * 能识别的标准结构：<pre><code class="mermaid">…</code></pre>
 *
 * 兼容 hexo-renderer-marked 的默认输出（它会生成 <figure class="highlight plaintext">
 * 或 <pre><code class="language-mermaid"> 等几种变体，这里全部兜底转成统一格式）。
 */
'use strict'

const LANG_CLASS = /language-([a-zA-Z0-9_-]+)/

// 从 mermaid 代码块里还原纯文本（marked 的 highlight 产物会把内容放在 <td class="code">
// 或者 <code> 下，每行被 <span class="line"> 包装；并且把特殊字符转成 HTML 实体）
function decodeHtmlEntities(str) {
  return String(str)
    .replace(/&#39;/g, "'")
    .replace(/&#42;/g, '*')
    .replace(/&#95;/g, '_')
    .replace(/&#123;/g, '{')
    .replace(/&#125;/g, '}')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function stripLineSpans(html) {
  // marked 默认输出的每行被 <span class="line">…</span><br> 包起来
  // 这里只取标签内的文本，然后按原顺序加换行
  const lines = []
  const re = /<span class="line">([\s\S]*?)<\/span>/g
  let m
  while ((m = re.exec(html)) !== null) {
    lines.push(m[1])
  }
  if (lines.length > 0) {
    // 去掉末尾的空行（marked 常追加一个空 line span）
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    return lines.join('\n')
  }
  return html
}

hexo.extend.filter.register('after_post_render', data => {
  if (!data || !data.content) return

  // 情况 A：hexo-renderer-marked 默认（hexo 自带 enable_code_highlight:highlight.js 时）
  // 输出：<figure class="highlight plaintext"><table><tr><td class="code"><pre>…</pre></td>…</table></figure>
  data.content = data.content.replace(
    /<figure class="highlight plaintext">([\s\S]*?)<\/figure>/g,
    (match, inner) => {
      // 只有当内部是 mermaid 内容时才替换
      // 简单识别：从 <pre> 中取代码第一行，看包含的语言信息是否为 mermaid
      // 因为 marked 在这里把语言信息丢掉了，所以用：
      //   1. 代码里有没有常见 mermaid 关键字：flowchart / sequenceDiagram / classDiagram / stateDiagram / journey / gantt / pie / requirementDiagram / gitGraph / erDiagram / mindmap / timeline …
      //   2. 或者前面紧邻块的原始 markdown 就是 ```mermaid（我们拿不到了，所以用关键字兜底 + 另一个正则配合）
      const preMatch = inner.match(/<td class="code"><pre>([\s\S]*?)<\/pre>\s*<\/td>/i)
      if (!preMatch) return match
      const rawContent = preMatch[1]
      const text = decodeHtmlEntities(stripLineSpans(rawContent))
      if (looksLikeMermaid(text)) {
        return buildMermaidBlock(text)
      }
      return match
    }
  )

  // 情况 B：有些渲染模式会输出 <pre><code class="language-mermaid">…</code></pre>
  // Butterfly 的 codeToMermaid 实际匹配的是 <pre><code class="mermaid">（不带 language- 前缀）
  // 所以这里把 language-mermaid 去掉前缀就行
  data.content = data.content.replace(
    /(<pre\s*[^>]*>)\s*<code([^>]*)class="([^"]*language-mermaid[^"]*)"([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/g,
    (_, preOpen, attrBefore, classes, attrAfter, codeHtml) => {
      const newClasses = classes
        .split(/\s+/)
        .filter(c => c && c !== 'language-mermaid')
      newClasses.push('mermaid')
      const codeClass = newClasses.length ? ` class="${newClasses.join(' ')}"` : ''
      return `${preOpen}<code${attrBefore}${codeClass}${attrAfter}>${codeHtml}</code></pre>`
    }
  )

  return data
}, 15 /* 在其他默认过滤器之后执行 */)

// 启发式：判断一段代码是不是 mermaid 语法
const MERMAID_START_KEYWORDS = [
  'flowchart',
  'graph',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'stateDiagram-v2',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'requirementDiagram',
  'gitGraph',
  'mindmap',
  'timeline',
  'quadrantChart',
  'block-beta',
  'sankey-beta',
  'zenuml',
  'C4Context',
  'C4Container',
  'C4Component',
  'C4Deployment'
]
function looksLikeMermaid(text) {
  if (!text) return false
  const t = text.replace(/^\s*%%\{init[\s\S]*?\}%%\s*\n?/, '').trimStart()
  const firstLine = t.split('\n')[0] || ''
  const firstToken = firstLine.trim().split(/\s+/)[0] || ''
  if (MERMAID_START_KEYWORDS.includes(firstToken)) return true
  // 子图放在开头（subgraph）也算（比如用户从第二行开始写，但第一行是子图）
  // 或者前面有空行但有 %% 注释后紧跟关键字
  const normalized = t.replace(/^\s*%%[^\n]*\n+/m, '').trimStart().split(/\s+/)[0]
  return MERMAID_START_KEYWORDS.includes(normalized)
}

function buildMermaidBlock(text) {
  // 输出：<pre><code class="mermaid">…escape…</code></pre>
  // 注意：这里必须原样保留 HTML 实体里的 < > & 给 Butterfly 解码，
  // 但为了防止浏览器先解析，把 text 里的 <>& 转成实体输出
  const escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<pre><code class="mermaid">${escaped}</code></pre>`
}

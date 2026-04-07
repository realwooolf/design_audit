const FIGMA_API = 'https://api.figma.com/v1';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, fileKey, nodeId, nodeIds, token, scale } = req.body || {};

  if (!fileKey || !token) {
    return res.status(400).json({ error: '缺少 fileKey 或 token' });
  }

  const headers = { 'X-Figma-Token': token };

  try {
    if (action === 'list') {
      return await handleList(fileKey, nodeId, headers, res);
    } else if (action === 'export') {
      return await handleExport(fileKey, nodeIds || [nodeId], headers, scale, res);
    } else if (action === 'props') {
      return await handleProps(fileKey, nodeIds || [nodeId], headers, res);
    } else {
      return res.status(400).json({ error: '无效的 action，请使用 list、export 或 props' });
    }
  } catch (err) {
    console.error('Figma export error:', err);
    return res.status(500).json({ error: '服务器错误，请稍后重试' });
  }
};

// 获取子节点列表（Section/Page 时用）
async function handleList(fileKey, nodeId, headers, res) {
  if (!nodeId) {
    return res.status(400).json({ error: '缺少 nodeId' });
  }

  const url = `${FIGMA_API}/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`;
  const resp = await fetch(url, { headers });

  if (!resp.ok) {
    return handleFigmaError(resp, res);
  }

  const data = await resp.json();
  const node = data.nodes?.[nodeId];

  if (!node || !node.document) {
    return res.status(404).json({ error: '未找到该节点，请检查链接' });
  }

  const doc = node.document;
  const frames = collectFrames(doc);

  return res.status(200).json({
    parentName: doc.name,
    parentType: doc.type,
    frames
  });
}

// 递归收集 FRAME 类型的子节点（只取直接子级和 Section 下的子级）
function collectFrames(node) {
  const frames = [];
  if (!node.children) return frames;

  for (const child of node.children) {
    if (child.type === 'FRAME' || child.type === 'COMPONENT' || child.type === 'COMPONENT_SET') {
      frames.push({ id: child.id, name: child.name, type: child.type });
    } else if (child.type === 'SECTION') {
      // Section 下的 Frame 也要收集
      if (child.children) {
        for (const grandChild of child.children) {
          if (grandChild.type === 'FRAME' || grandChild.type === 'COMPONENT' || grandChild.type === 'COMPONENT_SET') {
            frames.push({ id: grandChild.id, name: grandChild.name, type: grandChild.type, section: child.name });
          }
        }
      }
    }
  }
  return frames;
}

// 批量导出图片
async function handleExport(fileKey, nodeIds, headers, scale, res) {
  if (!nodeIds || nodeIds.length === 0) {
    return res.status(400).json({ error: '缺少 nodeIds' });
  }

  const ids = nodeIds.join(',');
  const s = scale || 2;
  const url = `${FIGMA_API}/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=png&scale=${s}`;
  const resp = await fetch(url, { headers });

  if (!resp.ok) {
    return handleFigmaError(resp, res);
  }

  const data = await resp.json();

  if (data.err) {
    return res.status(400).json({ error: `Figma 导出错误: ${data.err}` });
  }

  // 逐个下载图片并转 base64
  const images = [];
  for (const nid of nodeIds) {
    const imgUrl = data.images?.[nid];
    if (!imgUrl) {
      images.push({ nodeId: nid, image: null, error: '该节点无法导出图片' });
      continue;
    }

    try {
      const imgResp = await fetch(imgUrl);
      if (!imgResp.ok) {
        images.push({ nodeId: nid, image: null, error: '图片下载失败' });
        continue;
      }
      const arrayBuffer = await imgResp.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      images.push({ nodeId: nid, image: base64 });
    } catch (e) {
      images.push({ nodeId: nid, image: null, error: '图片下载超时' });
    }
  }

  return res.status(200).json({ images });
}

// 获取节点设计属性
async function handleProps(fileKey, nodeIds, headers, res) {
  if (!nodeIds || nodeIds.length === 0) {
    return res.status(400).json({ error: '缺少 nodeIds' });
  }
  const ids = nodeIds.join(',');
  const url = `${FIGMA_API}/files/${fileKey}/nodes?ids=${encodeURIComponent(ids)}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) return handleFigmaError(resp, res);

  const data = await resp.json();
  const results = {};
  const indexedNodes = {};  // nodeId → { nodeList, nodeSummary }
  for (const nid of nodeIds) {
    const node = data.nodes?.[nid]?.document;
    if (node) {
      results[nid] = extractDesignProps(node, 0, 6);
      indexedNodes[nid] = generateIndexedNodeList(node);
    }
  }
  return res.status(200).json({ props: results, indexedNodes });
}

// Figma RGBA {r,g,b,a} (0-1) → hex string
function rgbaToHex(color) {
  if (!color) return null;
  const r = Math.round((color.r || 0) * 255);
  const g = Math.round((color.g || 0) * 255);
  const b = Math.round((color.b || 0) * 255);
  const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  if (color.a != null && color.a < 1) {
    return hex + Math.round(color.a * 255).toString(16).padStart(2, '0');
  }
  return hex;
}

// 提取单个 fill 的可读信息
function parseFill(fill) {
  if (!fill || fill.visible === false) return null;
  if (fill.type === 'SOLID') {
    return { type: 'SOLID', color: rgbaToHex(fill.color), opacity: fill.opacity ?? 1 };
  }
  if (fill.type?.includes('GRADIENT')) {
    return { type: fill.type, stops: (fill.gradientStops || []).map(s => ({ color: rgbaToHex(s.color), position: s.position })) };
  }
  return { type: fill.type };
}

// 提取 effect 的可读信息
function parseEffect(eff) {
  if (!eff || eff.visible === false) return null;
  const result = { type: eff.type };
  if (eff.color) result.color = rgbaToHex(eff.color);
  if (eff.offset) result.offset = eff.offset;
  if (eff.radius != null) result.radius = eff.radius;
  if (eff.spread != null) result.spread = eff.spread;
  return result;
}

// 递归提取节点设计属性，maxDepth 控制递归深度
function extractDesignProps(node, depth, maxDepth) {
  if (!node) return null;
  const props = { name: node.name, type: node.type };

  // 尺寸 + 绝对坐标（用于精确标注定位）
  if (node.absoluteBoundingBox) {
    const bb = node.absoluteBoundingBox;
    props.x = Math.round(bb.x);
    props.y = Math.round(bb.y);
    props.width = Math.round(bb.width);
    props.height = Math.round(bb.height);
  }

  // 视觉属性
  if (node.fills?.length) {
    const parsed = node.fills.filter(f => f.visible !== false).map(parseFill).filter(Boolean);
    if (parsed.length) props.fills = parsed;
  }
  if (node.strokes?.length) {
    const parsed = node.strokes.filter(f => f.visible !== false).map(parseFill).filter(Boolean);
    if (parsed.length) {
      props.strokes = parsed;
      if (node.strokeWeight != null) props.strokeWeight = node.strokeWeight;
      if (node.strokeAlign) props.strokeAlign = node.strokeAlign;
    }
  }
  if (node.opacity != null && node.opacity < 1) props.opacity = node.opacity;
  if (node.cornerRadius != null && node.cornerRadius > 0) props.cornerRadius = node.cornerRadius;
  if (node.topLeftRadius > 0 || node.topRightRadius > 0 || node.bottomLeftRadius > 0 || node.bottomRightRadius > 0) {
    props.borderRadius = { tl: node.topLeftRadius || 0, tr: node.topRightRadius || 0, bl: node.bottomLeftRadius || 0, br: node.bottomRightRadius || 0 };
  }
  if (node.effects?.length) {
    const parsed = node.effects.filter(e => e.visible !== false).map(parseEffect).filter(Boolean);
    if (parsed.length) props.effects = parsed;
  }

  // 文字属性
  if (node.type === 'TEXT') {
    if (node.style) {
      const s = node.style;
      if (s.fontFamily) props.fontFamily = s.fontFamily;
      if (s.fontSize) props.fontSize = s.fontSize;
      if (s.fontWeight) props.fontWeight = s.fontWeight;
      if (s.lineHeightPx) props.lineHeight = Math.round(s.lineHeightPx * 10) / 10;
      if (s.letterSpacing) props.letterSpacing = Math.round(s.letterSpacing * 10) / 10;
      if (s.textAlignHorizontal) props.textAlign = s.textAlignHorizontal;
    }
    if (node.characters) props.text = node.characters.slice(0, 100);
  }

  // 布局属性
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    props.layoutMode = node.layoutMode;
    if (node.itemSpacing != null) props.itemSpacing = node.itemSpacing;
    if (node.paddingLeft) props.paddingLeft = node.paddingLeft;
    if (node.paddingRight) props.paddingRight = node.paddingRight;
    if (node.paddingTop) props.paddingTop = node.paddingTop;
    if (node.paddingBottom) props.paddingBottom = node.paddingBottom;

    // 计算子元素之间的实际间距
    const visibleChildren = (node.children || []).filter(c => c.visible !== false && c.absoluteBoundingBox);
    if (visibleChildren.length > 1) {
      const gaps = [];
      for (let i = 1; i < visibleChildren.length; i++) {
        const prev = visibleChildren[i - 1].absoluteBoundingBox;
        const curr = visibleChildren[i].absoluteBoundingBox;
        const gap = node.layoutMode === 'VERTICAL'
          ? Math.round(curr.y - (prev.y + prev.height))
          : Math.round(curr.x - (prev.x + prev.width));
        if (gap !== 0) {
          gaps.push({ between: `${visibleChildren[i - 1].name} → ${visibleChildren[i].name}`, gap });
        }
      }
      if (gaps.length) props.computedGaps = gaps;
    }
  }

  // 递归子节点
  if (node.children?.length && depth < maxDepth) {
    props.children = node.children
      .filter(c => c.visible !== false)
      .map(c => extractDesignProps(c, depth + 1, maxDepth))
      .filter(Boolean);
    if (!props.children.length) delete props.children;

    // 智能剪枝：无实质属性的包装节点（仅一个子节点）直接提升子节点
    if (props.children?.length === 1 && !props.fills && !props.strokes && !props.cornerRadius
        && !props.effects && !props.layoutMode && node.type !== 'TEXT') {
      const child = props.children[0];
      child._parentName = props.name;
      return child;
    }
  }

  return props;
}

// 生成编号节点列表：遍历 Figma 节点树，为每个有视觉属性的节点分配编号
// 返回 { nodeList: [...], nodeSummary: "文本清单" }
function generateIndexedNodeList(rootNode) {
  const frameBox = rootNode.absoluteBoundingBox;
  if (!frameBox || !frameBox.width || !frameBox.height) return { nodeList: [], nodeSummary: '' };

  const nodeList = [];
  let counter = 0;

  // 位置提示词
  function posHint(bb) {
    if (!bb) return '';
    const cy = ((bb.y - frameBox.y + bb.height / 2) / frameBox.height) * 100;
    const cx = ((bb.x - frameBox.x + bb.width / 2) / frameBox.width) * 100;
    let v = cy < 25 ? '顶部' : cy < 45 ? '中上部' : cy < 55 ? '中部' : cy < 75 ? '中下部' : '底部';
    let h = cx < 30 ? '左侧' : cx > 70 ? '右侧' : '';
    return h ? v + h : v;
  }

  // 短类型名
  function shortType(type) {
    const map = { FRAME: 'FRAME', GROUP: 'GROUP', RECTANGLE: 'RECT', ELLIPSE: 'ELLIPSE',
      TEXT: 'TEXT', VECTOR: 'VECTOR', COMPONENT: 'COMP', INSTANCE: 'INST',
      LINE: 'LINE', BOOLEAN_OPERATION: 'BOOL' };
    return map[type] || type;
  }

  function walk(node) {
    if (!node || node.visible === false) return;
    const bb = node.absoluteBoundingBox;
    const entry = {};
    let hasVisual = false;
    let summaryParts = [];

    // fills
    if (node.fills?.length) {
      const solid = node.fills.find(f => f.visible !== false && f.type === 'SOLID' && f.color);
      if (solid) {
        entry.fill = rgbaToHex(solid.color);
        summaryParts.push('填充' + entry.fill);
        hasVisual = true;
      }
    }
    // text
    if (node.type === 'TEXT' && node.style) {
      const s = node.style;
      if (s.fontSize) { entry.fontSize = s.fontSize; summaryParts.push(s.fontSize + 'px'); hasVisual = true; }
      if (s.fontWeight) { entry.fontWeight = s.fontWeight; summaryParts.push('字重' + s.fontWeight); hasVisual = true; }
      if (s.fontFamily) { entry.fontFamily = s.fontFamily; summaryParts.push(s.fontFamily); hasVisual = true; }
    }
    // cornerRadius
    if (node.cornerRadius > 0) { entry.cornerRadius = node.cornerRadius; summaryParts.push('圆角' + node.cornerRadius + 'px'); hasVisual = true; }
    // strokes
    if (node.strokes?.length) {
      const solid = node.strokes.find(f => f.visible !== false && f.type === 'SOLID' && f.color);
      if (solid) {
        entry.strokeColor = rgbaToHex(solid.color);
        if (node.strokeWeight) entry.strokeWeight = node.strokeWeight;
        summaryParts.push('描边' + entry.strokeColor + (node.strokeWeight ? ' ' + node.strokeWeight + 'px' : ''));
        hasVisual = true;
      }
    }
    // opacity
    if (node.opacity != null && node.opacity < 1) { entry.opacity = node.opacity; summaryParts.push('透明度' + node.opacity); hasVisual = true; }
    // spacing / padding (Auto Layout containers)
    if (node.layoutMode && node.layoutMode !== 'NONE') {
      if (node.itemSpacing != null) { entry.itemSpacing = node.itemSpacing; summaryParts.push('间距' + node.itemSpacing + 'px'); hasVisual = true; }
      const pt = node.paddingTop || 0, pr = node.paddingRight || 0, pb = node.paddingBottom || 0, pl = node.paddingLeft || 0;
      if (pt || pr || pb || pl) {
        entry.padding = `${pt}/${pr}/${pb}/${pl}`;
        summaryParts.push('padding ' + entry.padding);
        hasVisual = true;
      }
    }

    if (hasVisual && bb) {
      counter++;
      entry.index = counter;
      entry.name = node.name || '';
      entry.type = node.type;
      // bbox: 相对 frame 的百分比坐标（前端直接用于 CSS 定位）
      const relX = bb.x - frameBox.x;
      const relY = bb.y - frameBox.y;
      entry.bbox = {
        left: Math.max(0, Math.min(100, (relX / frameBox.width) * 100)),
        top: Math.max(0, Math.min(100, (relY / frameBox.height) * 100)),
        width: Math.max(0.5, Math.min(100, (bb.width / frameBox.width) * 100)),
        height: Math.max(0.5, Math.min(100, (bb.height / frameBox.height) * 100)),
      };
      entry.pos = posHint(bb);
      nodeList.push(entry);
    }

    if (node.children) {
      node.children.forEach(walk);
    }
  }

  walk(rootNode);

  // 生成文本清单（发给 Gemini，不含 bbox）
  const lines = nodeList.map(n => {
    const props = [];
    if (n.fill) props.push('填充' + n.fill);
    if (n.fontSize) props.push(n.fontSize + 'px');
    if (n.fontWeight) props.push('字重' + n.fontWeight);
    if (n.fontFamily) props.push(n.fontFamily);
    if (n.cornerRadius) props.push('圆角' + n.cornerRadius + 'px');
    if (n.strokeColor) props.push('描边' + n.strokeColor + (n.strokeWeight ? ' ' + n.strokeWeight + 'px' : ''));
    if (n.opacity != null) props.push('透明度' + n.opacity);
    if (n.itemSpacing != null) props.push('间距' + n.itemSpacing + 'px');
    if (n.padding) props.push('padding ' + n.padding);
    const propsStr = props.length ? ' — ' + props.join(', ') : '';
    return `#${n.index} [${shortType(n.type)}] ${n.name}${propsStr} (${n.pos})`;
  });

  return { nodeList, nodeSummary: lines.join('\n') };
}

// 统一处理 Figma API 错误
async function handleFigmaError(resp, res) {
  const status = resp.status;
  if (status === 403) {
    return res.status(403).json({ error: 'Figma Token 无效或已过期，请到 Figma Settings 重新生成' });
  }
  if (status === 404) {
    return res.status(404).json({ error: '未找到该 Figma 文件或节点，请检查链接' });
  }
  const text = await resp.text().catch(() => '');
  return res.status(status).json({ error: `Figma API 错误 (${status}): ${text.slice(0, 200)}` });
}

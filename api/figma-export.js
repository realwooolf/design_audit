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
    } else {
      return res.status(400).json({ error: '无效的 action，请使用 list 或 export' });
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

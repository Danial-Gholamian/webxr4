//insightSystem.js
/**
 * Calculates insights based on currently visible/filtered graph data.
 */
export function calculateInsights(nodes, links, currentSelection = { type: 'NONE', id: null }) {
  const degreeMap = new Map(); // nodeId -> count
  const groupActivity = new Map(); // groupName -> count

  // 1. Map out all nodes for quick group lookup
  const nodeLookup = new Map(nodes.map(n => [n.id, n]));

  // 2. Count degrees (interactions) in the CURRENT link set
  links.forEach(l => {
    const s = l.source.id || l.source;
    const t = l.target.id || l.target;
    
    degreeMap.set(s, (degreeMap.get(s) || 0) + 1);
    degreeMap.set(t, (degreeMap.get(t) || 0) + 1);

    // Group Heat logic
    const sGroup = nodeLookup.get(s)?.group;
    if (sGroup) groupActivity.set(sGroup, (groupActivity.get(sGroup) || 0) + 1);
  });

  // 3. Sort for Top/Bottom 3
  const sortedNodes = [...degreeMap.entries()].sort((a, b) => b[1] - a[1]);
  const sortedGroups = [...groupActivity.entries()].sort((a, b) => b[1] - a[1]);

  // Global Context
  const stats = {
    topHubs: sortedNodes.slice(0, 3).map(n => ({ id: n[0], count: n[1] })),
    bottomNodes: sortedNodes.slice(-3).reverse().map(n => ({ id: n[0], count: n[1] })),
    topGroups: sortedGroups.slice(0, 3).map(g => ({ name: g[0], count: g[1] })),
    avgDensity: (links.length / nodes.length).toFixed(2)
  };

  // 4. Handle Specific Selections (Node/Group)
  if (currentSelection.type === 'NODE') {
    const targetId = currentSelection.id;
    const rank = sortedNodes.findIndex(n => n[0] === targetId) + 1;
    stats.nodeRank = `${rank} / ${nodes.length}`;
    
    // Find "Best Friends" (Top 3 neighbors for this specific node)
    const neighbors = new Map();
    links.forEach(l => {
        const s = l.source.id || l.source;
        const t = l.target.id || l.target;
        if (s === targetId) neighbors.set(t, (neighbors.get(t) || 0) + 1);
        if (t === targetId) neighbors.set(s, (neighbors.get(s) || 0) + 1);
    });
    stats.bestFriends = [...neighbors.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3).map(n => n[0]);
  }

  return stats;
}
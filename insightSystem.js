/**
 * Calculates insights based on currently visible/filtered graph data.
 */
export function calculateInsights(nodes, links, currentSelection = { type: 'NONE', id: null }, globalBucketLinks = []) {
  const degreeMap = new Map(); 
  const groupActivity = new Map(); 

  // 1. Map out all nodes for quick group lookup
  const nodeLookup = new Map(nodes.map(n => [n.id, n]));
  
  const globalDegreeMap = new Map();
  const rankingSource = globalBucketLinks.length > 0 ? globalBucketLinks : links;

  rankingSource.forEach(l => {
    const s = l.source.id || l.source;
    const t = l.target.id || l.target;
    globalDegreeMap.set(s, (globalDegreeMap.get(s) || 0) + 1);
    globalDegreeMap.set(t, (globalDegreeMap.get(t) || 0) + 1);
  });

  const sortedGlobalNodes = [...globalDegreeMap.entries()].sort((a, b) => b[1] - a[1]);
  
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

  const sortedNodes = [...degreeMap.entries()].sort((a, b) => b[1] - a[1]);
  const sortedGroups = [...groupActivity.entries()].sort((a, b) => b[1] - a[1]);

  // ==========================================
  // AVERAGE DENSITY
  // Use the size of the global degree map (active nodes) instead of filtered nodes
  // ==========================================
  const totalActiveNodes = sortedGlobalNodes.length || 1; // Fallback to 1 to prevent divide-by-zero
  
  const stats = {
    topHubs: sortedNodes.slice(0, 3).map(n => {
      const nodeId = n[0];
      const nodeData = nodeLookup.get(nodeId); // Look up the full node info
      return { 
        id: nodeId, 
        count: n[1], 
        group: nodeData ? nodeData.group : 'N/A' //  Attach the group here
      };
    }),
    
    bottomNodes: sortedNodes.slice(-3).reverse().map(n => {
      const nodeId = n[0];
      const nodeData = nodeLookup.get(nodeId); // Look up the full node info
      return { 
        id: nodeId, 
        count: n[1], 
        group: nodeData ? nodeData.group : 'N/A' //  Attach the group here
      };
    }),

    topGroups: sortedGroups.slice(0, 3).map(g => ({ name: g[0], count: g[1] })),
    avgDensity: (rankingSource.length / totalActiveNodes).toFixed(2) 
  };

  // 4. Handle Specific Selections (Node/Group)
  if (currentSelection.type === 'NODE') {
    const targetId = currentSelection.id;
    
    const globalRank = sortedGlobalNodes.findIndex(n => n[0] === targetId) + 1;
    

    stats.nodeRank = globalRank > 0 ? `${globalRank} / ${totalActiveNodes} Active` : `N/A`;
    
    // Find "Best Friends" within the current time bucket
    const neighbors = new Map();
    rankingSource.forEach(l => {
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
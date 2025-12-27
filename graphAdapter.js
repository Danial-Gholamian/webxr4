// graphAdapter.js

export const graphAdapter = {
  // ---------- Node semantics ----------
  getNodeId(node) {
    return String(node.id);
  },

  getNodeGroup(node) {
    return node.group ?? "unknown";
  },

  // ---------- Edge semantics ----------
  getEdgeSource(edge) {
    return String(edge.source.id ?? edge.source);
  },

  getEdgeTarget(edge) {
    return String(edge.target.id ?? edge.target);
  },

  getEdgePeriods(edge) {
    return edge.periods || [];
  }
};
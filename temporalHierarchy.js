//temporalHierarchy.js
export function buildTemporalHierarchy({ T, deltaMin, b = 4 }) {
  if (!Number.isFinite(T) || T <= 0) {
    console.error('[Temporal] Invalid T:', T);
    return [];
  }

  if (!Number.isFinite(deltaMin) || deltaMin <= 0) {
    console.error('[Temporal] Invalid deltaMin:', deltaMin);
    return [];
  }

  const ratio = T / deltaMin;
  const L = Math.max(0, Math.ceil(Math.log(ratio) / Math.log(b)));

  const levels = [];

  for (let i = 0; i <= L; i++) {
    const delta = T / Math.pow(b, i);
    const count = Math.pow(b, i);

    const buckets = Array.from({ length: count }, (_, index) => ({
      id: `L${i}-B${index}`,
      level: i,
      index,
      start: index * delta,
      end: (index + 1) * delta
    }));
    console.log(`Danial: [Temporal] Level ${i}: delta=${delta}, buckets=${count}`);
    levels.push({ level: i, delta, buckets });
  }
  return levels;
}

export function buildTemporalTree(levels, b = 4) {
  if (!levels || levels.length === 0) return null;

  const nodeMap = new Map();

  // Create node objects
  levels.forEach(levelObj => {
    levelObj.buckets.forEach(bucket => {
      nodeMap.set(bucket.id, {
        ...bucket,
        parent: null,
        children: []
      });
    });
  });

  // Link parent → children
  for (let i = 0; i < levels.length - 1; i++) {
    const parentLevel = levels[i];
    const childLevel = levels[i + 1];

    parentLevel.buckets.forEach(parentBucket => {
      const parentNode = nodeMap.get(parentBucket.id);

      for (let k = 0; k < b; k++) {
        const childIndex = parentBucket.index * b + k;
        const childBucket = childLevel.buckets[childIndex];

        if (!childBucket) continue;

        const childNode = nodeMap.get(childBucket.id);
        childNode.parent = parentNode;
        parentNode.children.push(childNode);
      }
    });
  }

  // Root is always level 0 bucket 0
  return nodeMap.get(levels[0].buckets[0].id);
}

export function createTemporalNavigator(root) {
  let currentNode = root;

  return {
    getCurrentNode() {
      return currentNode;
    },

    selectNode(node) {
      if (!node) return;
      currentNode = node;
    },

    goToParent() {
      if (currentNode?.parent) {
        currentNode = currentNode.parent;
      }
    },

    getContext() {
      if (!currentNode) {
        return {
          parent: null,
          siblings: [],
          children: [],
          current: null
        };
      }

      const parent = currentNode.parent;

      return {
        parent,
        siblings: parent ? parent.children : [currentNode],
        children: currentNode.children ?? [],
        current: currentNode
      };
    }
  };
}



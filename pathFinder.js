// pathFinder.js
import * as THREE from 'three';

export class PathFinder {
  constructor(Graph, adjacency, directLinksMap, colorScale) {
    this.Graph = Graph;
    this.adjacency = adjacency;
    this.directLinksMap = directLinksMap;
    this.colorScale = colorScale;
    
    this.selectedNodes = [];
    this.pathColor = 0xFFA500; // Orange
    this.dimmedOpacity = 0.1;
    this.normalOpacity = 1.0;
  }

  findShortestPath(startId, endId) {
    const startStr = String(startId);
    const endStr = String(endId);

    if (!this.adjacency.has(startStr) || !this.adjacency.has(endStr)) return null;

    const queue = [[startStr]];
    const visited = new Set();

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];

      if (current === endStr) return path;

      if (!visited.has(current)) {
        visited.add(current);
        const neighbors = this.adjacency.get(current) || [];
        for (const neighbor of neighbors) {
          const neighborStr = String(neighbor);
          if (!visited.has(neighborStr)) {
            queue.push([...path, neighborStr]);
          }
        }
      }
    }
    return null;
  }

  highlightPaths(paths) {
    const allPathNodes = new Set();
    const allPathLinks = new Set();

    paths.forEach(path => {
      path.forEach(node => allPathNodes.add(String(node)));
      
      for (let i = 0; i < path.length - 1; i++) {
        const source = String(path[i]);
        const target = String(path[i+1]);
        
        const links = this.directLinksMap.get(source)?.filter(link => 
          (String(link.source) === source && String(link.target) === target) ||
          (String(link.source) === target && String(link.target) === source)
        ) || [];
        
        links.forEach(link => allPathLinks.add(link));
      }
    });

    this.Graph.scene().traverse(obj => {
      if (obj.__data?.id !== undefined) {
        const nodeId = String(obj.__data.id);
        if (allPathNodes.has(nodeId)) {
          obj.material.color.set(this.pathColor);
          obj.material.opacity = this.normalOpacity;
        } else {
          obj.material.color.set(this.colorScale(obj.__data.group));
          obj.material.opacity = this.dimmedOpacity;
        }
        obj.material.transparent = true;
        obj.material.needsUpdate = true;
      }

      if (obj.__data?.source !== undefined) {
        if (allPathLinks.has(obj.__data)) {
          obj.material.color.set(this.pathColor);
          obj.material.opacity = this.normalOpacity;
        } else {
          obj.material.color.set(0x888888);
          obj.material.opacity = this.dimmedOpacity;
        }
        obj.material.transparent = true;
        obj.material.needsUpdate = true;
      }
    });
  }

  handleVRSelection(nodeId) {
    const normalizedId = String(nodeId);
    
    if (!this.selectedNodes.includes(normalizedId)) {
      this.selectedNodes.push(normalizedId);
      console.log(`Selected node: ${normalizedId}`);

      if (this.selectedNodes.length >= 2) {
        const paths = [];
        for (let i = 1; i < this.selectedNodes.length; i++) {
          const path = this.findShortestPath(
            this.selectedNodes[i-1],
            this.selectedNodes[i]
          );
          if (path) paths.push(path);
        }
        if (paths.length > 0) {
          this.highlightPaths(paths);
        }
      }
    }
  }
//chan
  reset() {
    this.selectedNodes = [];
    this.Graph.graphData(this.Graph.graphData()); // Force refresh
    this.Graph.scene().traverse(obj => {
      if (obj.material) {
        obj.material.opacity = 1.0;
        obj.material.transparent = false;
        obj.material.needsUpdate = true;
      }
    });
  }
}
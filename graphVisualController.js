// GraphVisualController.js
// Given a graph and interaction state, it decides how it should look
import { markHoverCacheDirty } from "./hover";

/**
 * GraphVisualController
 *
 * Centralizes all graph-related visual logic, including:
 *  - Visibility policies for nodes and edges
 *  - Interaction-driven state (selection, group, temporal filtering)
 *  - Application of visual changes to Three.js objects
 *
 * Dataset semantics (e.g., how periods or groups are encoded)
 * are delegated to a dataset adapter.
 */
export class GraphVisualController {
    /**
     * @param {Object} params
     * @param {Object} params.graph - ForceGraph3D instance
     * @param {THREE.Scene} params.scene - Three.js scene
     * @param {THREE.LineSegments} params.lineSegments - Batched edge geometry
     * @param {Map} params.edgeVertexMap - Map edgeKey → vertex indices
     * @param {Object} params.adapter - Dataset adapter
     */
    constructor({ graph, scene, lineSegments, edgeVertexMap, adapter }) {
        // --- External dependencies (do not mutate ownership) ---
        this.graph = graph;
        this.scene = scene;
        this.lineSegments = lineSegments;
        this.edgeVertexMap = edgeVertexMap;
        this.adapter = adapter;

        // --- Internal interaction state ---
        this.state = {
            activeBucket: null, // { id, start, end, level?, index? }


            selection: {
                active: false,
                selectedNodeId: null,
                neighbors: new Set()
            },

            group: {
                active: false,
                nodeIds: new Set(),
                edgeIds: new Set()
            }
        };

        // --- Cached temporal data ---
        this.bucketActiveNodes = new Map(); // bucketId -> Set(nodeId)
        this._bucketIndex = null;           // { buckets: [], byId: Map }


        // --- Internal flags ---
        this._needsUpdate = false;

        // --- Baseline edge opacity ---
        this.BASE_EDGE_ALPHA = 0.6;

        this._onSelectionChange = null
    }

    // =========================================================
    // Public API — Dataset lifecycle
    // =========================================================

    /**
     * Load a new dataset into the controller.
     * Resets all interaction state and rebuilds internal caches.
     *
     * @param {Object} dataset - Raw dataset consumed by the adapter
     */
    setDataset(dataset) {
        this.dataset = dataset;

        this._resetState();
        this.bucketActiveNodes.clear();
        this._bucketIndex = null;

        // this.update();
        // NOTE: UNCOMMENTING THIS MAKES THE GRAPH UPDATE EVERYTIME 
        // WHEN Graph.onEnginestop is called in main.js
    }


    setEdgeLayer(lineSegments, edgeVertexMap) {
        this.lineSegments = lineSegments
        this.edgeVertexMap = edgeVertexMap
    }

    // =========================================================
    // Public API — Interaction methods
    // =========================================================

    highlightNode(nodeId) {
        const id = String(nodeId);

        this.state.selection.active = true;
        this.state.selection.selectedNodeId = id;
        this.state.selection.neighbors.clear();

        const bucket = this.state.activeBucket;

        this.graph.graphData().links.forEach(link => {

            if (bucket && !this._edgeInBucket(link, bucket)) return;

            const src = this.adapter.getEdgeSource(link);
            const tgt = this.adapter.getEdgeTarget(link);

            if (src === id) this.state.selection.neighbors.add(tgt);
            else if (tgt === id) this.state.selection.neighbors.add(src);
        });

        this._onSelectionChange?.(nodeId)

        this.update();
    }

    setSelectionListener(fn) {
        this._onSelectionChange = fn;
    }

    clearNodeSelection() {
        this.state.selection.active = false;
        this.state.selection.selectedNodeId = null;
        this.state.selection.neighbors.clear();
        this.update();
    }

    highlightGroup(groupId) {
        const normalized = String(groupId).toLowerCase();

        this.state.group.active = true;
        this.state.group.nodeIds.clear();
        this.state.group.edgeIds.clear();

        // Collect nodes
        this.graph.graphData().nodes.forEach(node => {
            const nodeGroup = String(this.adapter.getNodeGroup(node)).toLowerCase();
            if (nodeGroup === normalized) {
                this.state.group.nodeIds.add(this.adapter.getNodeId(node));
            }
        });

        // Collect edges
        this.graph.graphData().links.forEach(link => {
            const src = this.adapter.getEdgeSource(link);
            const tgt = this.adapter.getEdgeTarget(link);
            const key = this._getEdgeKey(src, tgt);

            if (
                this.state.group.nodeIds.has(src) &&
                this.state.group.nodeIds.has(tgt)
            ) {
                this.state.group.edgeIds.add(key);
            }
        });

        this.update();
    }

    clearGroupFilter() {
        this.state.group.active = false;
        this.state.group.nodeIds.clear();
        this.state.group.edgeIds.clear();
        this.update();
    }

    highlightBucket(bucket) {
      if (bucket && !this.bucketActiveNodes.has(bucket.id)) {
          // console.log(`[GraphController] Cache miss for bucket ${bucket.id}. Computing active nodes...`);
          
          const active = new Set();
          
          // Iterate all links to find which ones belong to this time slice
          this.graph.graphData().links.forEach(link => {
              if (this._edgeInBucket(link, bucket)) {
                  // If link is active, its nodes must be active too
                  const src = this.adapter.getEdgeSource(link);
                  const tgt = this.adapter.getEdgeTarget(link);
                  active.add(src);
                  active.add(tgt);
              }
          });

          // Save to cache so we don't do this work next frame
          this.bucketActiveNodes.set(bucket.id, active);
      }

      // 2. Proceed as normal
      this.state.activeBucket = bucket;
      this.clearNodeSelection();
      this.update();
    }


    clearBucketFilter() {
        this.state.activeBucket = null;
        this.update();
    }


    resetAll() {
        console.log("edgeVertexMap size:", this.edgeVertexMap.size);
        this._resetState();

        const lines = [];
        this.scene.traverse(o => {
            if (o.isLineSegments) lines.push(o);
        });

        // Update selected node variable
        this._onSelectionChange?.(null); 
        console.log('LineSegments in scene:', lines.length, lines);
        this.update();
    }

    // =========================================================
    // Public API — Update hook
    // =========================================================

    /**
     * Apply visibility policies and update rendering.
     * This replaces updateAllVisuals().
     */
    update() {
        console.log("edgeVertexMap size:", this.edgeVertexMap.size);
        // console.trace("GraphVisualController.update");
        const ctx = this._buildVisibilityContext();

        this._updateNodeVisuals(ctx);
        this._updateEdgeVisuals(ctx);

        this.graph.d3ReheatSimulation?.();
    }

    // =========================================================
    // Optional introspection
    // =========================================================

    getState() {
        return {
            activeBucket: this.state.activeBucket,
            selectedNodeId: this.state.selection.selectedNodeId,
            activeGroup: this.state.group.active
        };
    }

    // =========================================================
    // Internal helpers — Visibility context & policy
    // =========================================================

    _buildVisibilityContext() {
      return {
          activeBucket: this.state.activeBucket,
          bucketNodes: this.state.activeBucket
              ? this.bucketActiveNodes?.get(this.state.activeBucket.id)
              : null,
          selection: this.state.selection,
          group: this.state.group
      };

    }


    _isNodeVisible(nodeId, ctx) {
        // Period constraint (hard)
        if (ctx.activeBucket && !ctx.bucketNodes?.has(nodeId)) {
            return false;
        }


        // Group constraint
        if (ctx.group.active && !ctx.group.nodeIds.has(nodeId)) {
            return false;
        }

        // election constraint (period-aware!)
        if (ctx.selection.active) {
            const selId = ctx.selection.selectedNodeId;

            if (!ctx.activeBucket) {
                return (
                    nodeId === selId ||
                    ctx.selection.neighbors.has(nodeId)
                );
            }

            // Period-scoped neighbors
            const bucketNeighbors = this._getBucketNeighbors(selId, ctx.activeBucket);


            return (
                nodeId === selId ||
                bucketNeighbors.has(nodeId)
            );
        }

        return true;
    }

    _isEdgeVisible(link, ctx) {
        const src = this.adapter.getEdgeSource(link);
        const tgt = this.adapter.getEdgeTarget(link);
        const key = this._getEdgeKey(src, tgt);

      if (ctx.activeBucket && !this._edgeInBucket(link, ctx.activeBucket)) return false;


        if (ctx.group.active && !ctx.group.edgeIds.has(key)) return false;

        if (ctx.selection.active) {
            return (
                src === ctx.selection.selectedNodeId ||
                tgt === ctx.selection.selectedNodeId
            );
        }

        return true;
    }

    // ------------------------------
    // Internal helper for node visuals
    // ------------------------------
    _applyOpacityLayer(obj, context, visible) {
        const base = obj.userData.originalMaterial ||= obj.material;

        // Clone per context (e.g., periodMaterial, selectionMaterial)
        const key = context + "Material";
        if (!obj.userData[key]) {
            obj.userData[key] = base.clone();
        }

        const mat = obj.userData[key];
        mat.transparent = true;
        mat.opacity = visible ? 1.0 : 0.1;
        mat.needsUpdate = true;

        obj.material = mat;
    }

    // =========================================================
    // Internal helpers — Rendering
    // =========================================================

    _updateNodeVisuals(ctx) {
        this.graph.scene().traverse(obj => {
            if (!obj.__data) return;

            // // ✅ Only node meshes have __data.id
            // if (!obj.__data?.id) return;

            const nodeId = this.adapter.getNodeId(obj.__data);
            const visible = this._isNodeVisible(nodeId, ctx);

            this._applyOpacityLayer(obj, "combined", visible);
        });
    }

    _updateEdgeVisuals(ctx) {
        const alphas = this.lineSegments.geometry.attributes.alpha.array;
        console.log(
            "edges:",
            this.lineSegments.geometry.attributes.alpha.array.length
        );

        this.graph.graphData().links.forEach(link => {
            const src = this.adapter.getEdgeSource(link);
            const tgt = this.adapter.getEdgeTarget(link);
            const key = this._getEdgeKey(src, tgt);
            const entry = this.edgeVertexMap.get(key);
            if (!entry) return;

            const visible = this._isEdgeVisible(link, ctx);
            const a = visible ? this.BASE_EDGE_ALPHA : 0.0;

            alphas[entry.start] = a;
            alphas[entry.end] = a;
        });

        this.lineSegments.geometry.attributes.alpha.needsUpdate = true;
    }

    // =========================================================
    // Internal helpers -- Precomputation
    // =========================================================

    _precomputeBucketData(buckets) {
        // buckets: [{ id, start, end, level?, index? }, ...]
        this.bucketActiveNodes.clear();
        this._bucketIndex = {
            buckets,
            byId: new Map(buckets.map(b => [b.id, b]))
        };

        // For each bucket, mark which nodes are active in it
        for (const bucket of buckets) {
            const active = new Set();
            this.graph.graphData().links.forEach(link => {
                if (!this._edgeInBucket(link, bucket)) return;

                const src = this.adapter.getEdgeSource(link);
                const tgt = this.adapter.getEdgeTarget(link);
                active.add(src);
                active.add(tgt);
            });
            this.bucketActiveNodes.set(bucket.id, active);
        }
    }


    _resetState() {
        this.state.activeBucket = null;
        this.state.selection.active = false;
        this.state.selection.selectedNodeId = null;
        this.state.selection.neighbors.clear();
        this.state.group.active = false;
        this.state.group.nodeIds.clear();
        this.state.group.edgeIds.clear();
    }

    _getEdgeKey(a, b) {
        return [a, b].sort().join("--");
    }

    _isTimeInBucket(t, bucket) {
      return t >= bucket.start && t < bucket.end;
      }

    _edgeInBucket(link, bucket) {
        if (!bucket) return true;
        const times = this.adapter.getEdgePeriods(link) || []; // currently returns edge.times (compat)
        for (const t of times) {
            if (this._isTimeInBucket(t, bucket)) return true;
        }
        return false;
      }


    /**
     * Query node visibility for an arbitrary period context
     * (used by secondary views like PeriodStack)
     */
    isNodeVisibleInContext(nodeId, bucket) {
        const ctx = {
            activeBucket: bucket,
            bucketNodes: bucket ? this.bucketActiveNodes.get(bucket.id) : null,
            selection: this.state.selection,
            group: this.state.group
        };
        return this._isNodeVisible(String(nodeId), ctx);
      }

    /**
     * Query edge visibility for an arbitrary period context
     */
    isEdgeVisibleInContext(link, bucket) {
        const ctx = {
            activeBucket: bucket,
            bucketNodes: bucket ? this.bucketActiveNodes.get(bucket.id) : null,
            selection: this.state.selection,
            group: this.state.group
        };
        return this._isEdgeVisible(link, ctx);
    }

    _getBucketNeighbors(nodeId, bucket) {
        const neighbors = new Set();
        if (!bucket) return neighbors;

        this.graph.graphData().links.forEach(link => {
            if (!this._edgeInBucket(link, bucket)) return;

            const src = this.adapter.getEdgeSource(link);
            const tgt = this.adapter.getEdgeTarget(link);

            if (src === nodeId) neighbors.add(tgt);
            if (tgt === nodeId) neighbors.add(src);
        });

        return neighbors;
    }

    setBuckets(buckets) {
    this._precomputeBucketData(buckets);
    this.update();
    }


}

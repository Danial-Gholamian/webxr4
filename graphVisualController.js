// GraphVisualController.js
// Given a graph and interaction state, it decides how it should look
import { createSelectionRing } from "./filterUIPanel";
import { markHoverCacheDirty } from "./hover";
import { calculateInsights } from "./insightSystem";

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
        this.temporal_subscribers = new Set();
        this.selection_subscribers = new Set();

        // Node selection highlight
        this._isRemoteUpdate;
        this.remoteSelectedNodeId = null;
        this._previousSelectedNodeId = null;

        this.globalStart = 0;
        this.globalDuration = 1;

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
            },
            edgeMode: 'ALL' // Modes: 'ALL', 'INTRA_ONLY', 'INTER_ONLY'
        };



        // --- Cached temporal data ---
        this.bucketActiveNodes = new Map(); // bucketId -> Set(nodeId)
        this._bucketIndex = null;           // { buckets: [], byId: Map }


        // --- Internal flags ---
        this._needsUpdate = false;

        // --- Baseline edge opacity ---
        this._modeChanged = false;
        this._bucketChanged = false; // ADD THIS
        this.BASE_EDGE_ALPHA = 0.45;

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
        this.nodesById = new Map(dataset.nodes.map(n => [String(n.id), n]));
        const numSlots = 200;
        this.numSlots = numSlots;

        this.dataset.links.forEach(link => {
            const times = this.adapter.getEdgeTimes(link);
            const mask = new Uint8Array(numSlots);

            times.forEach(t => {
                // FIXED: Now this.globalStart and duration are defined
                const ratio = (t - this.globalStart) / this.globalDuration;
                const slot = Math.floor(ratio * (numSlots - 1));

                if (slot >= 0 && slot < numSlots) {
                    mask[slot] = 1;
                }
            });
            link._bitmask = mask;
        });

        this._resetState();
        this.bucketActiveNodes.clear();
        this.update();
    }

    setTimelineContext(start, duration) {
        this.globalStart = start;
        this.globalDuration = duration;
    }

    setEdgeLayer(lineSegments, edgeVertexMap) {
        this.lineSegments = lineSegments
        this.edgeVertexMap = edgeVertexMap
    }

    // =========================================================
    // Public API — Interaction methods
    // =========================================================

    highlightNode(nodeId) {
        this.clearNodeSelection()
        // Clear any existing group selection 
        if (this.state.group.active) {
            this.clearGroupFilter()
        }
        const id = String(nodeId);

        if (this._previousSelectedNodeId && this._previousSelectedNodeId !== id) {
            this._removeRingFromNode(this._previousSelectedNodeId);
        }

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

        // BROADCAST NODE SELECTION (HIGHLIGHT RING)

        this._broadcastSelection(id);

        this.update();
    }

    _broadcastSelection(nodeId) {
        if (this._isRemoteUpdate) return;

        if (this._selectionBroadcaster) {
            this._selectionBroadcaster(nodeId);
        }
    }

    setSelectionBroadcaster(fn) {
        this._selectionBroadcaster = fn;
    }

    setRemoteSelection(nodeId) {
        this.remoteSelectedNodeId = nodeId ? String(nodeId) : null;
        this.update();
    }


    setSelectionListener(fn) {
        this._onSelectionChange = fn;
    }

    clearNodeSelection() {
        this.state.selection.active = false;
        this.state.selection.selectedNodeId = null;
        this.state.selection.neighbors.clear();
        this._broadcastSelection(null);

        this.update();
    }

    _clearNodeSelectionState() {
        this.state.selection.active = false;
        this.state.selection.selectedNodeId = null;
        this.state.selection.neighbors.clear();

        this._onSelectionChange?.(null);
    }

    highlightGroup(groupId) {
        // // Clear any node selection that might be in place as well TODO
        if (this.state.selection.active) {
            this._clearNodeSelectionState()
        }
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
        console.log(bucket)
        if (this.state.activeBucket?.id !== bucket?.id) {
            this._bucketChanged = true;
        }
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

        // Proceed as normal
        this.state.activeBucket = bucket;
        // this.clearNodeSelection();

        if (this.state.selection.active) {
            this._updateSelectionForBucket(bucket);
        }

        this.update();

        //   Notify UI modules that are listening to temporal changes
        this._notifyTimeChanges(bucket)
    }

    _updateSelectionForBucket(bucket) {
        const selectedId = this.state.selection.selectedNodeId;
        if (!selectedId || !bucket) return;

        this.state.selection.neighbors.clear();

        // 1. Only check links actually connected to the selected node
        const localLinks = this.graph.graphData().links.filter(link => {
            const s = this.adapter.getEdgeSource(link);
            const t = this.adapter.getEdgeTarget(link);
            return s === selectedId || t === selectedId;
        });

        // 2. Only add neighbors if the edge is active in the current bucket (Bitmask check)
        localLinks.forEach(link => {
            if (!this._edgeInBucket(link, bucket)) return;

            const src = this.adapter.getEdgeSource(link);
            const tgt = this.adapter.getEdgeTarget(link);

            const neighborId = (src === selectedId) ? tgt : src;
            this.state.selection.neighbors.add(neighborId);
        });
    }


    clearBucketFilter() {
        this.state.activeBucket = null;
        this.update();
    }


    resetAll() {
        console.log("RESET ALL IN PROGRESS...")
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
    //THIS CHNAGED
    // =========================================================
    // Public API — Update hook
    // =========================================================

    /**
     * Apply visibility policies and update rendering.
     * This replaces updateAllVisuals().
     */
    update() {
        if (this.state.selection.active && this.state.activeBucket) {
            this._updateSelectionForBucket(this.state.activeBucket);
        }

        const ctx = this._buildVisibilityContext();
        this._updateNodeVisuals(ctx);

        if (this.state.activeBucket) {
            this.updateEdgeUniforms(this.state.activeBucket.start, this.state.activeBucket.end);
        }

        this._updateEdgeVisuals(ctx);
        this.graph.d3ReheatSimulation?.();

        // --- CRITICAL FIX: EFFECTIVE VISIBILITY ---
        const { nodes, links } = this.getFilteredData();
        const selectedId = this.state.selection.selectedNodeId;

        // Is the selected node actually visible in the current time/group filter?
        const isSelectedNodeVisible = nodes.some(n => String(n.id) === selectedId);

        // This is what the UI should actually care about
        const effectiveSelectionActive = this.state.selection.active && isSelectedNodeVisible;

        const selection = {
            type: effectiveSelectionActive ? 'NODE' : 'NONE',
            id: selectedId
        };

        const stats = calculateInsights(nodes, links, selection);

        // Notify subscribers with the EFFECTIVE visibility
        this.selection_subscribers.forEach(fn =>
            fn(stats, effectiveSelectionActive, this.state.edgeMode)
        );
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
        // 1. SELECTION LOGIC: If selection is active, only show the node or active neighbors
        if (ctx.selection.active) {
            return nodeId === ctx.selection.selectedNodeId || ctx.selection.neighbors.has(nodeId);
        }

        // 2. GROUP LOGIC
        if (ctx.group.active && !ctx.group.nodeIds.has(nodeId)) return false;

        // 3. TEMPORAL LOGIC (General View)
        if (ctx.activeBucket && !ctx.bucketNodes?.has(nodeId)) return false;

        return true;
    }




    _isEdgeVisible(link, ctx) {
        const srcId = this.adapter.getEdgeSource(link);
        const tgtId = this.adapter.getEdgeTarget(link);

        // 1. TEMPORAL FILTER (Always check the bitmask!)
        if (ctx.activeBucket && !this._edgeInBucket(link, ctx.activeBucket)) return false;

        // 2. MODE LOGIC (Intra/Inter)
        if (this.state.edgeMode !== 'ALL') {
            const srcNode = this.nodesById.get(srcId);
            const tgtNode = this.nodesById.get(tgtId);
            if (!srcNode || !tgtNode) return false;

            const isIntra = srcNode.group === tgtNode.group;
            if (this.state.edgeMode === 'INTRA_ONLY' && !isIntra) return false;
            if (this.state.edgeMode === 'INTER_ONLY' && isIntra) return false;
        }

        // 3. SELECTION/GROUP FILTERING
        if (ctx.selection.active) {
            return (srcId === ctx.selection.selectedNodeId || tgtId === ctx.selection.selectedNodeId);
        }

        if (ctx.group.active) {
            return ctx.group.edgeIds.has(this._getEdgeKey(srcId, tgtId));
        }

        return true;
    }

    // A public method to toggle
    setEdgeMode(mode) {
        this.state.edgeMode = mode;
        this._modeChanged = true; // Set flag to force a full edge redraw
        this.update();
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

            // // Only node meshes have __data.id
            // if (!obj.__data?.id) return;

            const nodeId = this.adapter.getNodeId(obj.__data);
            const visible = this._isNodeVisible(nodeId, ctx);

            this._applyOpacityLayer(obj, "combined", visible);


            const isSelected =
                ctx.selection.active &&
                nodeId === ctx.selection.selectedNodeId;

            const isRemoteSelected =
                this.remoteSelectedNodeId &&
                nodeId === this.remoteSelectedNodeId;

            const isInBucket =
                ctx.activeBucket
                    ? ctx.bucketNodes?.has(nodeId)
                    : true;


            const mat = obj.material;

            // ============================
            // NEW LOGIC STARTS HERE FOR TRACKING NODE SELECTION VISIBILITY
            // ============================

            // Check if ring already exists
            // LOCAL ring (your selection)
            let localRing = obj.children.find(c => c.userData?.isLocalRing);

            // REMOTE ring (other user)
            let remoteRing = obj.children.find(c => c.userData?.isRemoteRing);

            if (isRemoteSelected) {
                if (!remoteRing) {
                    remoteRing = createSelectionRing();
                    remoteRing.userData.isRemoteRing = true;

                    remoteRing.material.color.set(0xff0000); // RED other user
                    remoteRing.material.depthTest = false;
                    remoteRing.renderOrder = 1000;

                    obj.add(remoteRing);
                }

                remoteRing.visible = true;
                remoteRing.position.set(0, 0, 0);
                remoteRing.scale.setScalar((obj.scale?.x || 1) * 4);
                remoteRing.quaternion.copy(this.graph.camera().quaternion);

            } else if (remoteRing) {
                remoteRing.visible = false;
            }
        });
    }

    _updateEdgeVisuals(ctx) {
        if (!this.lineSegments) return;

        const isStandardAllMode = !ctx.selection.active && !ctx.group.active && this.state.edgeMode === 'ALL';

        // The Gate now opens if mode changed OR if the timeline bucket changed
        if (isStandardAllMode && !this._modeChanged && !this._bucketChanged) {
            return;
        }

        this._modeChanged = false;
        this._bucketChanged = false; // Reset the flag

        const alphas = this.lineSegments.geometry.attributes.alpha.array;
        this.graph.graphData().links.forEach(link => {
            const key = this._getEdgeKey(this.adapter.getEdgeSource(link), this.adapter.getEdgeTarget(link));
            const entry = this.edgeVertexMap.get(key);
            if (!entry) return;

            // Use the accurate bitmask check
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
        if (!bucket || !link._bitmask) return true;

        // Convert bucket start/end to slot indices (0 to 199)
        const startRatio = (bucket.start - this.globalStart) / this.globalDuration;
        const endRatio = (bucket.end - this.globalStart) / this.globalDuration;

        let startSlot = Math.floor(startRatio * (this.numSlots - 1));
        let endSlot = Math.floor(endRatio * (this.numSlots - 1));

        // Clamp indices to array bounds
        startSlot = Math.max(0, Math.min(startSlot, this.numSlots - 1));
        endSlot = Math.max(0, Math.min(endSlot, this.numSlots - 1));

        for (let i = startSlot; i <= endSlot; i++) {
            if (link._bitmask[i] === 1) return true;
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

    // This sections handles updating other UI modules that depend on the user
    // changing/traversing through different time stamps
    subscribeToTimeChanges(uiObject) {
        this.temporal_subscribers.add(uiObject);
    }

    _unsubscribeToTimeChanges(uiObject) {
        this.temporal_subscribers.delete(uiObject);
    }

    _notifyTimeChanges(bucket) {
        this.temporal_subscribers.forEach(uiObject => uiObject(bucket))
    }

    // This sections add UI modules that update based on selected graph objects
    // e.g node or group selection. Insight Panel
    subscribeToSelection(fn) {
        this.selection_subscribers.add(fn);
    }

    unsubscribeFromSelection(fn) {
        this.selection_subscribers.delete(fn);
    }

    _notifyInsights(stats) {
        this.selection_subscribers.forEach(fn =>
            fn(stats, this.state.selection.active, this.state.edgeMode) // Pass edgeMode as 3rd arg
        );
    }

    /**
     * Returns the subset of data currently passing all filters (Time, Group, etc.)
     */
    getFilteredData() {
        const nodes = this.graph.graphData().nodes;
        const links = this.graph.graphData().links;

        // Use the internal visibility logic to pick the "winners"
        const ctx = this._buildVisibilityContext();

        const visibleLinks = links.filter(l => this._isEdgeVisible(l, ctx));
        const visibleNodes = nodes.filter(n => this._isNodeVisible(n.id, ctx));

        return { nodes: visibleNodes, links: visibleLinks };
    }


    clearAllSelection() {
        this._clearNodeSelectionState();
        this.clearGroupFilter();

        // Ensure the next update() call treats this as a "Full Redraw"
        this._modeChanged = true;
        this.update();
    }


    updateEdgeUniforms(start, end) {
        if (!this.lineSegments || !this.lineSegments.material.uniforms) return;

        // Update the uniforms we defined in buildBatchedEdges
        this.lineSegments.material.uniforms.uTimeStart.value = start;
        this.lineSegments.material.uniforms.uTimeEnd.value = end;
    }

}

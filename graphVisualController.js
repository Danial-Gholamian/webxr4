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
            activePeriod: null,

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
        this.periodActiveNodes = new Map();

        // --- Internal flags ---
        this._needsUpdate = false;
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
        this._precomputePeriodData();

        this.update();
    }

    // =========================================================
    // Public API — Interaction methods
    // =========================================================

    highlightNode(nodeId) {
        const id = String(nodeId);

        this.state.selection.active = true;
        this.state.selection.selectedNodeId = id;
        this.state.selection.neighbors.clear();

        // Compute neighbors using adapter semantics
        this.graph.graphData().links.forEach(link => {
            const src = this.adapter.getEdgeSource(link);
            const tgt = this.adapter.getEdgeTarget(link);

            if (src === id) this.state.selection.neighbors.add(tgt);
            else if (tgt === id) this.state.selection.neighbors.add(src);
        });

        this.update();
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

    highlightPeriod(periodId) {
        this.state.activePeriod = periodId;
        this.clearNodeSelection();
        this.update();
    }

    clearPeriodFilter() {
        this.state.activePeriod = null;
        this.update();
    }

    resetAll() {
        this._resetState();
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
            activePeriod: this.state.activePeriod,
            selectedNodeId: this.state.selection.selectedNodeId,
            activeGroup: this.state.group.active
        };
    }

    // =========================================================
    // Internal helpers — Visibility context & policy
    // =========================================================

    _buildVisibilityContext() {
        return {
            activePeriod: this.state.activePeriod,
            periodNodes: this.state.activePeriod
                ? this.periodActiveNodes.get(this.state.activePeriod)
                : null,
            selection: this.state.selection,
            group: this.state.group
        };
    }

    _isNodeVisible(nodeId, ctx) {
        if (ctx.activePeriod && !ctx.periodNodes?.has(nodeId)) return false;
        if (ctx.group.active && !ctx.group.nodeIds.has(nodeId)) return false;

        if (ctx.selection.active) {
            return (
                nodeId === ctx.selection.selectedNodeId ||
                ctx.selection.neighbors.has(nodeId)
            );
        }

        return true;
    }

    _isEdgeVisible(link, ctx) {
        const src = this.adapter.getEdgeSource(link);
        const tgt = this.adapter.getEdgeTarget(link);
        const key = this._getEdgeKey(src, tgt);

        if (ctx.activePeriod) {
            const periods = this.adapter.getEdgePeriods(link);
            if (!periods.includes(ctx.activePeriod)) return false;
        }

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

            const nodeId = this.adapter.getNodeId(obj.__data);
            const visible = this._isNodeVisible(nodeId, ctx);

            this._applyOpacityLayer(obj, "combined", visible);
        });
    }

    _updateEdgeVisuals(ctx) {
        const alphas = this.lineSegments.geometry.attributes.alpha.array;

        this.graph.graphData().links.forEach(link => {
            const src = this.adapter.getEdgeSource(link);
            const tgt = this.adapter.getEdgeTarget(link);
            const key = this._getEdgeKey(src, tgt);
            const entry = this.edgeVertexMap.get(key);
            if (!entry) return;

            const visible = this._isEdgeVisible(link, ctx);
            const a = visible ? 1.0 : 0.0;

            alphas[entry.start] = a;
            alphas[entry.end] = a;
        });

        this.lineSegments.geometry.attributes.alpha.needsUpdate = true;
    }

    // =========================================================
    // Internal helpers — Precomputation
    // =========================================================

    _precomputePeriodData() {
        this.periodActiveNodes.clear();

        this.graph.graphData().links.forEach(link => {
            const periods = this.adapter.getEdgePeriods(link) || [];
            const src = this.adapter.getEdgeSource(link);
            const tgt = this.adapter.getEdgeTarget(link);

            periods.forEach(period => {
                if (!this.periodActiveNodes.has(period)) {
                    this.periodActiveNodes.set(period, new Set());
                }
                this.periodActiveNodes.get(period).add(src);
                this.periodActiveNodes.get(period).add(tgt);
            });
        });
    }

    _resetState() {
        this.state.activePeriod = null;
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
}

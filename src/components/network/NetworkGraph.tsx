import React, { useState, useRef, useMemo } from 'react';
import {
  GraphNode,
  GraphEdge,
  NodeType,
} from '../../types';
import { RiskBadge, RiskScoreGauge } from '../common/RiskBadge';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Layers,
  ArrowRight,
  Info,
  Stethoscope,
  Building2,
  User,
  FileSpreadsheet,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';

interface NetworkGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelectNode?: (nodeId: string) => void;
  selectedNodeId?: string;
  networkTitle?: string;
}

export const NetworkGraph: React.FC<NetworkGraphProps> = ({
  nodes,
  edges,
  onSelectNode,
  selectedNodeId,
  networkTitle = 'Computed network',
}) => {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 30, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [hopFilter, setHopFilter] = useState<number>(3);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [activeNode, setActiveNode] = useState<GraphNode | null>(
    nodes.find((n) => n.id === selectedNodeId) || nodes[0] || null
  );
  const [showPropagationModal, setShowPropagationModal] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'svg' || (e.target as HTMLElement).tagName === 'rect') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoom = (delta: number) => {
    setScale((prev) => Math.max(0.5, Math.min(2.5, prev + delta)));
  };

  const handleReset = () => {
    setScale(1);
    setPan({ x: 30, y: 20 });
  };

  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchesSearch =
        searchQuery === '' ||
        n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'ALL' || n.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [nodes, searchQuery, filterType]);

  const visibleNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    return edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );
  }, [edges, visibleNodeIds]);

  const getNodeIcon = (type: NodeType) => {
    switch (type) {
      case 'PROVIDER':
        return <Stethoscope className="w-3.5 h-3.5 text-blue-600" />;
      case 'FACILITY':
        return <Building2 className="w-3.5 h-3.5 text-amber-600" />;
      case 'MEMBER':
        return <User className="w-3.5 h-3.5 text-emerald-600" />;
      case 'CLAIM':
        return <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />;
      case 'INVESTIGATION':
        return <FolderOpen className="w-3.5 h-3.5 text-rose-600" />;
      default:
        return <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getNodeColors = (score: number) => {
    if (score >= 85) return { fill: '#fff1f2', stroke: '#f43f5e', text: '#9f1239' };
    if (score >= 70) return { fill: '#fffbeb', stroke: '#f59e0b', text: '#92400e' };
    if (score >= 50) return { fill: '#fefce8', stroke: '#eab308', text: '#854d0e' };
    return { fill: '#eff6ff', stroke: '#3b82f6', text: '#1e40af' };
  };

  const handleNodeClick = (node: GraphNode) => {
    setActiveNode(node);
    if (onSelectNode) onSelectNode(node.id);
  };

  const activeNodeConnections = useMemo(() => {
    if (!activeNode) return [];
    return edges.filter((e) => e.source === activeNode.id || e.target === activeNode.id);
  }, [activeNode, edges]);

  return (
    <div className="relative flex flex-col h-full bg-slate-50/50 rounded-xl border border-slate-200/90 overflow-hidden shadow-xs">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border-b border-slate-200 z-10">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-semibold text-slate-900">{networkTitle}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {filteredNodes.length} Entities • {filteredEdges.length} Connections
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search entity by name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-48"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Entities</option>
            <option value="PROVIDER">Doctors Only</option>
            <option value="FACILITY">Clinics & Hospitals</option>
            <option value="MEMBER">Patients</option>
            <option value="CLAIM">Claims</option>
          </select>

          {/* Secondary Risk Flow Button */}
          <button
            onClick={() => setShowPropagationModal(!showPropagationModal)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            How Risk Spreads
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={() => handleZoom(-0.15)}
              className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 text-[11px] font-mono text-slate-600">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => handleZoom(0.15)}
              className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleReset}
              className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-white ml-0.5 border-l border-slate-200"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="relative flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none bg-white"
      >
        <svg
          className="w-full h-full"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(203, 213, 225, 0.45) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {/* Edges */}
            {filteredEdges.map((edge) => {
              const srcNode = nodes.find((n) => n.id === edge.source);
              const tgtNode = nodes.find((n) => n.id === edge.target);
              if (!srcNode || !tgtNode) return null;

              const isConnectedToActive =
                activeNode &&
                (activeNode.id === edge.source || activeNode.id === edge.target);

              const strokeColor = edge.isSuspicious
                ? isConnectedToActive
                  ? '#e11d48'
                  : '#f97316'
                : '#94a3b8';
              const strokeWidth = isConnectedToActive ? 2.5 : edge.weight ? Math.min(2.5, edge.weight * 0.7) : 1.5;

              const midX = ((srcNode.x || 0) + (tgtNode.x || 0)) / 2;
              const midY = ((srcNode.y || 0) + (tgtNode.y || 0)) / 2;

              return (
                <g key={edge.id}>
                  <line
                    x1={srcNode.x}
                    y1={srcNode.y}
                    x2={tgtNode.x}
                    y2={tgtNode.y}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={edge.isSuspicious ? 'none' : '4,4'}
                    opacity={isConnectedToActive ? 1 : 0.65}
                    className="transition-all duration-300"
                  />
                  {edge.label && (
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x="-48"
                        y="-9"
                        width="96"
                        height="18"
                        rx="4"
                        fill="#ffffff"
                        stroke="#cbd5e1"
                        strokeWidth="0.8"
                        opacity="0.95"
                      />
                      <text
                        textAnchor="middle"
                        y="3"
                        fill={edge.isSuspicious ? '#b91c1c' : '#475569'}
                        fontSize="9"
                        fontFamily="sans-serif"
                        fontWeight="600"
                      >
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {filteredNodes.map((node) => {
              const colors = getNodeColors(node.riskScore);
              const isSelected = activeNode?.id === node.id;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x || 100}, ${node.y || 100})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNodeClick(node);
                  }}
                  className="cursor-pointer group"
                >
                  {/* Subtle pulse if Flagship or Critical */}
                  {(node.isFlagship || node.riskScore >= 90) && (
                    <circle
                      r="26"
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="1.5"
                      opacity="0.4"
                    />
                  )}

                  {/* Node Circle */}
                  <circle
                    r={isSelected ? 22 : node.isFlagship ? 20 : 17}
                    fill={colors.fill}
                    stroke={isSelected ? '#2563eb' : colors.stroke}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    className="transition-all duration-200 group-hover:scale-110 shadow-xs"
                  />

                  {/* Score */}
                  <text
                    textAnchor="middle"
                    y="4"
                    fill={colors.text}
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {node.riskScore}
                  </text>

                  {/* Label */}
                  <text
                    textAnchor="middle"
                    y={isSelected ? 36 : 30}
                    fill="#1e293b"
                    fontSize="11"
                    fontWeight="600"
                  >
                    {node.label}
                  </text>

                  {/* Sublabel */}
                  {node.sublabel && (
                    <text
                      textAnchor="middle"
                      y={isSelected ? 47 : 41}
                      fill="#64748b"
                      fontSize="9"
                    >
                      {node.sublabel}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 bg-white/95 border border-slate-200 rounded-lg p-2.5 shadow-xs text-xs space-y-1 z-10">
          <div className="font-semibold text-slate-700 text-[11px]">
            Risk Legend
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-rose-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              Critical Risk (85+)
            </span>
            <span className="flex items-center gap-1.5 text-amber-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              High Risk (70-84)
            </span>
            <span className="flex items-center gap-1.5 text-blue-700">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Low / Normal
            </span>
          </div>
        </div>

        {/* Secondary Risk Modal */}
        {showPropagationModal && (
          <div className="absolute top-4 left-4 max-w-md bg-white border border-rose-200 rounded-xl p-4 shadow-lg z-20 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <h4 className="text-xs font-bold text-slate-900">
                  How Risk Spreads Between Connected Doctors
                </h4>
              </div>
              <button
                onClick={() => setShowPropagationModal(false)}
                className="text-slate-400 hover:text-slate-700 text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              When a doctor has very high billing anomalies, colleagues who share the same clinic and exchange high volumes of patients also have higher potential risk exposure:
            </p>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
              {nodes.filter((node) => node.type === 'PROVIDER').map((node) => (
                <div key={node.id} className="flex items-center justify-between font-medium text-slate-700">
                  <span>{node.label} ({node.id})</span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 font-mono">{node.riskScore} Risk Score</span>
                </div>
              ))}
              {nodes.filter((node) => node.type === 'PROVIDER').length === 0 && (
                <span className="text-slate-500">No connected providers detected.</span>
              )}
            </div>

            <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex gap-2">
              <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                <strong>Important Note:</strong> Higher shared exposure means this connection should be reviewed. It does <em>not</em> mean the connected doctors committed fraud.
              </span>
            </div>
          </div>
        )}

        {/* Selected Entity Card */}
        {activeNode && (
          <div className="absolute top-4 right-4 w-76 bg-white border border-slate-200 rounded-xl p-4 shadow-lg z-20 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  {getNodeIcon(activeNode.type)}
                  <span className="text-[10px] font-semibold uppercase text-slate-400">
                    {activeNode.type}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                  {activeNode.label}
                </h3>
                <p className="text-xs text-slate-500">{activeNode.sublabel}</p>
              </div>
              <RiskScoreGauge score={activeNode.riskScore} size="sm" />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase">ID</span>
                <span className="font-semibold text-slate-800 font-mono">{activeNode.id}</span>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase">Risk Tier</span>
                <RiskBadge level={activeNode.riskLevel} showScore={false} />
              </div>
            </div>

            <div>
              <h4 className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider mb-1.5">
                Connections ({activeNodeConnections.length})
              </h4>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1 text-xs">
                {activeNodeConnections.map((edge) => {
                  const otherNodeId =
                    edge.source === activeNode.id ? edge.target : edge.source;
                  const otherNode = nodes.find((n) => n.id === otherNodeId);
                  const isOutbound = edge.source === activeNode.id;

                  return (
                    <div
                      key={edge.id}
                      onClick={() => otherNode && handleNodeClick(otherNode)}
                      className="p-1.5 rounded bg-slate-50 border border-slate-200 hover:bg-slate-100 cursor-pointer transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-slate-400 text-[10px]">
                          {isOutbound ? '→' : '←'} {edge.type}
                        </span>
                        <span className="text-slate-800 font-medium truncate">
                          {otherNode?.label || otherNodeId}
                        </span>
                      </div>
                      {edge.isSuspicious && (
                        <span className="text-[10px] text-rose-700 font-medium px-1 py-0.2 rounded bg-rose-100">
                          Flag
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => {
                if (onSelectNode) onSelectNode(activeNode.id);
              }}
              className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              View Full Profile <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

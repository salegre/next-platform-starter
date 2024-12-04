// components/site-structure.tsx
import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Globe, ExternalLink, FileText, AlertTriangle, XCircle, Info } from 'lucide-react';

interface PageLink {
  url: string;
  text: string;
  type: 'internal' | 'external';
}

interface AuditResult {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details?: string;
  url?: string;  // Make sure we capture the URL from audit results
}

interface PageNode {
  url: string;
  title: string;
  links: PageLink[];
  level: number;
  parentUrl?: string;
}

interface SiteStructureProps {
  structure: {
    totalPages: number;
    maxDepth: number;
    internalLinks: number;
    externalLinks: number;
  };
  pages?: PageNode[];
  auditResults?: AuditResult[];  // Change to array of audit results
  onPageClick?: (pageUrl: string) => void;
}

export default function SiteStructure({ structure, pages = [], auditResults = [], onPageClick }: SiteStructureProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNode = (url: string) => {
    const newExpanded = new Set(expandedNodes);
    if (expandedNodes.has(url)) {
      newExpanded.delete(url);
    } else {
      newExpanded.add(url);
    }
    setExpandedNodes(newExpanded);
  };

  // Helper function to normalize URLs for comparison
  const normalizeUrl = (url: string): string => {
    try {
      return new URL(url).pathname.replace(/\/$/, '');
    } catch {
      return url.replace(/\/$/, '');
    }
  };

  const getAuditCounts = (pageUrl: string) => {
    const normalizedPageUrl = normalizeUrl(pageUrl);
    const results = auditResults.filter(result => {
      const resultUrl = result.url ? normalizeUrl(result.url) : '';
      return resultUrl === normalizedPageUrl;
    });

    return results.reduce((acc, result) => {
      if (result.severity === 'error') acc.errors++;
      if (result.severity === 'warning') acc.warnings++;
      if (result.severity === 'info') acc.infos++;
      return acc;
    }, { errors: 0, warnings: 0, infos: 0 });
  };

  const renderAuditIcons = (url: string) => {
    const counts = getAuditCounts(url);
    
    return (
      <div className="flex items-center gap-2 ml-2">
        {counts.errors > 0 && (
          <div className="flex items-center text-red-500" title={`${counts.errors} errors`}>
            <XCircle size={16} />
            <span className="text-xs ml-1">{counts.errors}</span>
          </div>
        )}
        {counts.warnings > 0 && (
          <div className="flex items-center text-yellow-500" title={`${counts.warnings} warnings`}>
            <AlertTriangle size={16} />
            <span className="text-xs ml-1">{counts.warnings}</span>
          </div>
        )}
        {counts.infos > 0 && (
          <div className="flex items-center text-blue-500" title={`${counts.infos} info messages`}>
            <Info size={16} />
            <span className="text-xs ml-1">{counts.infos}</span>
          </div>
        )}
      </div>
    );
  };

  // Create a map to track parent-child relationships
  const pagesByParent: Record<string, PageNode[]> = {};
  const processedUrls = new Set<string>();

  // Process pages to build hierarchy safely
  pages.forEach(page => {
    if (processedUrls.has(page.url)) return;
    processedUrls.add(page.url);

    const parent = page.parentUrl || 'root';
    if (!pagesByParent[parent]) {
      pagesByParent[parent] = [];
    }
    if (page.parentUrl !== page.url) {
      pagesByParent[parent].push(page);
    }
  });

  const renderNode = (node: PageNode, processedNodes = new Set<string>()) => {
    if (processedNodes.has(node.url)) return null;
    processedNodes.add(node.url);

    const isExpanded = expandedNodes.has(node.url);
    const children = pagesByParent[node.url] || [];
    const hasChildren = children.length > 0;
    
    return (
      <div key={node.url} className="mt-2">
        <div className="flex items-center gap-2 hover:bg-gray-100 p-2 rounded">
          <div 
            className="cursor-pointer"
            onClick={() => toggleNode(node.url)}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
            ) : (
              <FileText size={16} className="text-gray-400" />
            )}
          </div>
          <span 
            className="text-blue-600 hover:underline cursor-pointer flex-grow"
            onClick={() => onPageClick?.(node.url)}
          >
            {node.title || node.url}
          </span>
          {renderAuditIcons(node.url)}
        </div>
        
        {isExpanded && (
          <div className="ml-6 border-l pl-4">
            {node.links.length > 0 && (
              <div className="text-sm text-gray-600 mt-2">
                <p>Links ({node.links.length}):</p>
                <ul className="ml-4">
                  {node.links.slice(0, 5).map((link, index) => (
                    <li key={index} className="flex items-center gap-2">
                      {link.type === 'external' ? <ExternalLink size={12} /> : <Globe size={12} />}
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:underline truncate max-w-md"
                      >
                        {link.text || link.url}
                      </a>
                    </li>
                  ))}
                  {node.links.length > 5 && (
                    <li className="text-gray-500 italic mt-1">
                      {`... and ${node.links.length - 5} more links`}
                    </li>
                  )}
                </ul>
              </div>
            )}
            
            {children.map(childNode => renderNode(childNode, new Set(processedNodes)))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4">Site Structure Analysis</h2>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded">
          <p className="text-sm text-blue-600">Total Pages</p>
          <p className="text-2xl font-bold">{structure.totalPages}</p>
        </div>
        <div className="bg-green-50 p-4 rounded">
          <p className="text-sm text-green-600">Max Depth</p>
          <p className="text-2xl font-bold">{structure.maxDepth}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded">
          <p className="text-sm text-purple-600">Internal Links</p>
          <p className="text-2xl font-bold">{structure.internalLinks}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded">
          <p className="text-sm text-orange-600">External Links</p>
          <p className="text-2xl font-bold">{structure.externalLinks}</p>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Page Hierarchy</h3>
        {pagesByParent['root']?.map(node => renderNode(node, new Set()))}
      </div>
    </div>
  );
}
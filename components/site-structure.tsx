import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Globe, ExternalLink, FileText } from 'lucide-react';

interface PageLink {
  url: string;
  text: string;
  type: 'internal' | 'external';
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
  onPageClick?: (pageUrl: string) => void;  // Added this line
}

export default function SiteStructure({ structure, pages = [], onPageClick }: SiteStructureProps) {
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

  // Group pages by their level and parent
  const pagesByParent = pages.reduce((acc, page) => {
    const parent = page.parentUrl || 'root';
    if (!acc[parent]) {
      acc[parent] = [];
    }
    acc[parent].push(page);
    return acc;
  }, {} as Record<string, PageNode[]>);

  const renderNode = (node: PageNode) => {
    const isExpanded = expandedNodes.has(node.url);
    const hasChildren = pagesByParent[node.url]?.length > 0;
    
    return (
      <div key={node.url} className="mt-2">
        <div 
          className="flex items-center gap-2 hover:bg-gray-100 p-2 rounded"
        >
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
            className="text-blue-600 hover:underline cursor-pointer"
            onClick={() => onPageClick?.(node.url)}
          >
            {node.title || node.url}
          </span>
        </div>
        
        {isExpanded && (
          <div className="ml-6 border-l pl-4">
            {node.links.length > 0 && (
              <div className="text-sm text-gray-600 mt-2">
                <p>Links:</p>
                <ul className="ml-4">
                  {node.links.map((link, index) => (
                    <li key={index} className="flex items-center gap-2">
                      {link.type === 'external' ? <ExternalLink size={12} /> : <Globe size={12} />}
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {link.text || link.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {pagesByParent[node.url]?.map(childNode => renderNode(childNode))}
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
        {pagesByParent['root']?.map(node => renderNode(node))}
      </div>
    </div>
  );
}
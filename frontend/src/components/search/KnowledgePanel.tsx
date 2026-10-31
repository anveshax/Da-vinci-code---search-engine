import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { KnowledgePanelData } from '../../types/api';

interface KnowledgePanelProps {
  data: KnowledgePanelData;
}

export const KnowledgePanel: React.FC<KnowledgePanelProps> = ({ data }) => {
  return (
    <aside
      aria-label="Knowledge panel"
      className="rounded-2xl bg-[#282a2c] border border-[#3c4043] p-5 text-left space-y-4 shadow-sm"
    >
      {/* Header: Title, Subtitle, Entity Badge */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-[#bdc1c6]">
          <span className="uppercase text-[11px] tracking-wider text-[#9aa0a6] font-medium">
            {data.entity_type?.replace('_', ' ') || 'Overview'}
          </span>
          <span className="text-[#8ab4f8] flex items-center gap-1 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Knowledge</span>
          </span>
        </div>

        <h3 className="text-xl sm:text-2xl font-normal text-[#e8eaed] tracking-tight">
          {data.title}
        </h3>

        {data.subtitle && (
          <p className="text-xs text-[#bdc1c6] font-sans">
            {data.subtitle}
          </p>
        )}
      </div>

      {/* Image if available */}
      {data.image_url && (
        <div className="w-full h-44 rounded-xl overflow-hidden bg-[#202124] border border-[#3c4043]">
          <img
            src={data.image_url}
            alt={data.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Overview Description */}
      <p className="text-sm text-[#bdc1c6] leading-relaxed font-sans">
        {data.description}
      </p>

      {/* Facts & Attributes Table */}
      {data.attributes && data.attributes.length > 0 && (
        <div className="pt-2 border-t border-[#3c4043] space-y-2">
          <div className="divide-y divide-[#3c4043] text-xs font-sans">
            {data.attributes.map((attr, idx) => (
              <div key={idx} className="py-2 flex items-start justify-between gap-3">
                <span className="text-[#9aa0a6] font-medium shrink-0">{attr.label}</span>
                <span className="text-[#e8eaed] text-right">{attr.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Official Resources */}
      {data.tech_resources && data.tech_resources.length > 0 && (
        <div className="pt-2 border-t border-[#3c4043] space-y-2">
          <span className="text-xs font-medium text-[#9aa0a6] block">Profiles & Resources</span>
          <div className="space-y-1.5">
            {data.tech_resources.map((res, idx) => (
              <a
                key={idx}
                href={res.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-[#202124] hover:bg-[#303134] border border-[#3c4043] flex items-center justify-between text-xs text-[#8ab4f8] transition-colors"
              >
                <span className="truncate">{res.title}</span>
                <span className="text-[10px] text-[#9aa0a6] px-1.5 py-0.5 rounded bg-[#303134] shrink-0">
                  {res.badge}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Attribution & Source Link */}
      {data.source_url && (
        <div className="pt-2 border-t border-[#3c4043] flex items-center justify-between text-xs text-[#9aa0a6]">
          <span>{data.attribution || 'Wikipedia'}</span>
          <a
            href={data.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8ab4f8] hover:underline flex items-center gap-1"
          >
            <span>Source</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </aside>
  );
};

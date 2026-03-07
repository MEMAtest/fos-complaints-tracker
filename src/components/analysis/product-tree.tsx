'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import type { FOSProductTreeNode } from '@/lib/fos/types';
import { formatNumber, formatPercent } from '@/lib/utils';

interface ProductTreeProps {
  productTree: FOSProductTreeNode[];
  activeProducts: string[];
  activeFirms: string[];
  onToggleProduct: (product: string) => void;
  onToggleFirm: (firm: string) => void;
}

export function ProductTree({
  productTree,
  activeProducts,
  activeFirms,
  onToggleProduct,
  onToggleFirm,
}: ProductTreeProps) {
  if (productTree.length === 0) {
    return <EmptyState label="No product tree data under current filters." />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {productTree.slice(0, 8).map((productNode) => (
        <Card key={`product-tree-${productNode.product}`} className="border-slate-200 bg-slate-50">
          <CardContent className="p-3">
            <button onClick={() => onToggleProduct(productNode.product)}>
              <Badge
                variant={activeProducts.includes(productNode.product) ? 'default' : 'outline'}
                className="text-xs"
              >
                {productNode.product}
              </Badge>
            </button>
            <p className="mt-2 text-xs text-slate-600">
              {formatNumber(productNode.total)} decisions in this product scope.
            </p>
            <div className="mt-2 space-y-1.5">
              {productNode.firms.slice(0, 4).map((firmNode) => {
                const share = productNode.total ? (firmNode.total / productNode.total) * 100 : 0;
                return (
                  <button
                    key={`node-${productNode.product}-${firmNode.firm}`}
                    onClick={() => onToggleFirm(firmNode.firm)}
                    className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                      activeFirms.includes(firmNode.firm)
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-blue-200'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="line-clamp-1 text-xs font-medium text-slate-800">
                        {firmNode.firm}
                      </span>
                      <span className="text-[11px] text-slate-600">{share.toFixed(1)}%</span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

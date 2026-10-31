import { useReactTable, getCoreRowModel, flexRender, createColumnHelper, Row, Cell, Header, HeaderGroup } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useKpmData } from '../hooks/useKpmData';
import { BansosRecipient } from '../types/bansos';
import { Loader2, ChevronDown, User, Hash, MapPin, Info, Edit, Trash2, Printer } from 'lucide-react';

const columnHelper = createColumnHelper<BansosRecipient>();

interface KpmTableProps {
  filters: {
    programType: string;
    status?: string;
  };
  onEdit?: (recipient: BansosRecipient) => void;
  onDelete?: (id: string, name: string) => void;
  onPrint?: (recipient: BansosRecipient) => void;
  isAdmin?: boolean;
}

export const KpmTable: React.FC<KpmTableProps> = ({ filters, onEdit, onDelete, onPrint, isAdmin = false }) => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useKpmData(filters);

  const flatData = useMemo(() => 
    data?.pages.flatMap(page => page.data) ?? [], 
  [data]);

  const columns = useMemo(() => [
    columnHelper.accessor('nikMasked', {
      header: () => (
        <div className="flex items-center space-x-2">
          <Hash className="w-3.5 h-3.5 text-slate-400" />
          <span>NIK</span>
        </div>
      ),
      cell: info => <span className="font-mono text-slate-600">{info.getValue() || '*********'}</span>,
    }),
    columnHelper.accessor('nameMasked', {
      header: () => (
        <div className="flex items-center space-x-2">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span>Nama Penerima</span>
        </div>
      ),
      cell: info => <span className="font-bold text-slate-900 uppercase">{info.getValue() || 'NAMA DISAMARKAN'}</span>,
    }),
    columnHelper.accessor(row => `Dusun ${row.dusun ?? '?'}, RT ${row.rt ?? '?'}`, {
      id: 'address',
      header: () => (
        <div className="flex items-center space-x-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span>Wilayah</span>
        </div>
      ),
      cell: info => <span className="text-slate-600">{info.getValue()}</span>,
    }),
    columnHelper.accessor('status', {
      header: () => (
        <div className="flex items-center space-x-2">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>Status</span>
        </div>
      ),
      cell: info => {
        const status = info.getValue() as string;
        const colors: Record<string, string> = {
          tersalurkan: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          siap_diambil: 'bg-blue-100 text-blue-700 border-blue-200',
          proses_verifikasi: 'bg-amber-100 text-amber-700 border-amber-200',
          ditangguhkan: 'bg-rose-100 text-rose-700 border-rose-200',
        };
        const label: Record<string, string> = {
          tersalurkan: 'Tersalurkan',
          siap_diambil: 'Siap Diambil',
          proses_verifikasi: 'Verifikasi',
          ditangguhkan: 'Ditangguhkan',
        };
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${colors[status] || 'bg-slate-100'}`}>
            {label[status] || status}
          </span>
        );
      },
    }),
    // Action Column (Admin Only)
    columnHelper.display({
      id: 'actions',
      header: () => <div className="text-right">Aksi</div>,
      cell: info => {
        if (!isAdmin) return null;
        const recipient = info.row.original;
        return (
          <div className="flex items-center justify-end space-x-1">
            {onPrint && (
              <button 
                onClick={() => onPrint(recipient)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Cetak Resi"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
            {onEdit && (
              <button 
                onClick={() => onEdit(recipient)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                title="Edit Data"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {onDelete && (
              <button 
                onClick={() => onDelete(recipient.id, recipient.name)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Hapus Data"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      }
    })
  ], [isAdmin, onEdit, onDelete, onPrint]);

  const table = useReactTable({
    data: flatData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-2xl border border-slate-100">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-500 text-sm font-medium">Menghubungkan ke pusat data desa...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center bg-rose-50 rounded-2xl border border-rose-100 text-rose-600">
        <p className="font-bold">Gagal memuat data</p>
        <p className="text-xs mt-1">Pastikan koneksi internet stabil atau hubungi admin desa.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup: HeaderGroup<BansosRecipient>) => (
              <tr key={headerGroup.id} className="bg-slate-50/80 border-b border-slate-200">
                {headerGroup.headers.map((header: Header<BansosRecipient, unknown>) => (
                  <th key={header.id} className="px-6 py-4 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row: Row<BansosRecipient>) => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors group">
                  {row.getVisibleCells().map((cell: Cell<BansosRecipient, unknown>) => (
                    <td key={cell.id} className="px-6 py-4 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-20 text-center text-slate-400">
                  Tidak ada data KPM ditemukan untuk kriteria ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {hasNextPage && (
        <div className="flex justify-center">
          <button 
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="flex items-center space-x-2 px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 font-bold text-xs transition-all shadow-sm hover:shadow-md disabled:opacity-50"
          >
            {isFetchingNextPage ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-emerald-500" />
            )}
            <span>{isFetchingNextPage ? 'Memuat Data...' : 'Lihat Lebih Banyak KPM'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

import { IRanking } from "models/Ranking";
import Link from "next/link";
import { Country } from "./country-flag";

export function RankingsTable({ rankings }: { rankings: IRanking[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Keyword</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tracked Since</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {rankings.map((ranking) => (
            <tr key={ranking._id.toString()} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                <Link href={`/keyword/${ranking._id}`} className="text-blue-500 hover:underline">
                  {ranking.keyword}
                </Link>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-500">
                <a href={ranking.linkUrl || ranking.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {ranking.url}
                </a>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ranking.position ?? 'Pending'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {ranking.location && ranking.country !== 'Global' ? (
                  <div className="flex items-center gap-2">
                    <Country code={ranking.country} />
                    {ranking.location}
                  </div>
                ) : (
                  'Global'
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(ranking.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
// components/project-card.tsx
import React from 'react';
import Link from 'next/link';
import { IProject } from 'models/Project';

export function ProjectCard({ project }: { project: IProject }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold text-gray-900">{project.name}</h3>
      <p className="text-gray-600 mt-2">{project.domain}</p>
      {project.description && (
        <p className="text-gray-500 mt-2">{project.description}</p>
      )}
      <div className="mt-4 flex justify-between items-center">
        <Link 
          href={`/projects/${project._id.toString()}`}
          className="text-blue-500 hover:underline"
        >
          View Details
        </Link>
        <span className="text-sm text-gray-500">
          Created: {new Date(project.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
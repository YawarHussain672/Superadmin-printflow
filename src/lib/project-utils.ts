import { Project, FileUpload, Dispatch } from "@prisma/client";
import { getPresignedUrl } from "./s3";

type ProjectWithRelations = Project & {
  files?: FileUpload[];
  dispatch?: Dispatch | null;
};

export async function signProjectUrls(project: ProjectWithRelations): Promise<ProjectWithRelations> {
  const signedProject = { ...project };

  if (signedProject.piPdfUrl) {
    signedProject.piPdfUrl = await getPresignedUrl(signedProject.piPdfUrl);
  }

  if (signedProject.files && signedProject.files.length > 0) {
    signedProject.files = await Promise.all(
      signedProject.files.map(async (file) => ({
        ...file,
        url: await getPresignedUrl(file.url),
      }))
    );
  }

  if (signedProject.dispatch?.podUrl) {
    signedProject.dispatch = {
      ...signedProject.dispatch,
      podUrl: await getPresignedUrl(signedProject.dispatch.podUrl),
    };
  }

  return signedProject;
}

export async function signProjectsUrls(projects: ProjectWithRelations[]): Promise<ProjectWithRelations[]> {
  return Promise.all(projects.map((project) => signProjectUrls(project)));
}

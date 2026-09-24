import { createJob } from "@/lib/jobs";

export const runtime = "nodejs";

export async function POST(request) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send an image as multipart form data." }, { status: 400 });
  }

  const image = form.get("image");
  if (!(image instanceof File) || !["image/png", "image/jpeg"].includes(image.type)) {
    return Response.json({ error: "Choose a PNG or JPG image." }, { status: 400 });
  }
  if (!image.size || image.size > 8 * 1024 * 1024) {
    return Response.json({ error: "Image must be between 1 byte and 8 MB." }, { status: 400 });
  }

  const kind = form.get("kind") || "extraction";
  if (!["extraction", "startup_test"].includes(kind)) {
    return Response.json({ error: "Choose table extraction or a GPU startup test." }, { status: 400 });
  }

  try {
    const job = await createJob(image, kind);
    return Response.json({ jobId: job.id }, { status: 201 });
  } catch (error) {
    console.error("Could not create job:", error);
    return Response.json({ error: "Could not save the upload. Please try again." }, { status: 503 });
  }
}

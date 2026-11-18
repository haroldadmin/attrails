import { useEffect, useReducer, useRef } from "react";
import {
  ROUTE_IMAGE_MAX_SIZE_BYTES,
  ROUTE_MAX_IMAGES,
  type RouteImage,
  type UploadedRouteImage,
} from "@/lib/routes/shared";
import { photoErrorMessage } from "./photo-messages";
import type { UploadPhotoResult } from "./upload-photo";

export type UploadPhoto = (formData: FormData) => Promise<UploadPhotoResult>;

export type PhotoStatus =
  | { state: "saved"; cid: string }
  | { state: "uploading" }
  | { state: "failed"; error: string }
  | { state: "ready"; image: UploadedRouteImage };

export type Photo = {
  id: string;
  previewUrl: string;
  alt: string;
  status: PhotoStatus;
};

type State = { photos: Photo[]; announcement: string };

type Action =
  | { type: "added"; photos: Photo[]; ignored: number }
  | { type: "uploaded"; id: string; image: UploadedRouteImage }
  | { type: "failed"; id: string; error: string }
  | { type: "removed"; id: string }
  | { type: "alt-changed"; id: string; alt: string };

function reducer(state: State, action: Action): State {
  if (action.type === "added") {
    const { photos, ignored } = action;
    return {
      photos: [...state.photos, ...photos],
      announcement:
        ignored > 0
          ? `You can add up to ${ROUTE_MAX_IMAGES} photos, so ${ignored} ${ignored === 1 ? "photo wasn't" : "photos weren't"} added.`
          : "",
    };
  }

  // Uploads can finish after their photo was removed.
  const index = state.photos.findIndex(({ id }) => id === action.id);
  if (index === -1) {
    return state;
  }
  const photo = state.photos[index];
  const number = index + 1;

  switch (action.type) {
    case "uploaded":
      return {
        photos: state.photos.with(index, {
          ...photo,
          status: { state: "ready", image: action.image },
        }),
        announcement: `Photo ${number} uploaded.`,
      };
    case "failed":
      return {
        photos: state.photos.with(index, {
          ...photo,
          status: { state: "failed", error: action.error },
        }),
        announcement: `Photo ${number} couldn't be uploaded: ${action.error}`,
      };
    case "removed":
      return {
        photos: state.photos.toSpliced(index, 1),
        announcement: `Photo ${number} removed.`,
      };
    case "alt-changed":
      return {
        ...state,
        photos: state.photos.with(index, { ...photo, alt: action.alt }),
      };
  }
}

async function upload(
  uploadPhoto: UploadPhoto,
  id: string,
  file: File,
): Promise<Action> {
  if (file.size > ROUTE_IMAGE_MAX_SIZE_BYTES) {
    return { type: "failed", id, error: photoErrorMessage("too-large") };
  }

  const formData = new FormData();
  formData.set("photo", file);
  try {
    const result = await uploadPhoto(formData);
    return result.ok
      ? { type: "uploaded", id, image: result.image }
      : { type: "failed", id, error: result.error };
  } catch (error) {
    console.error(error);
    return { type: "failed", id, error: photoErrorMessage("write-failed") };
  }
}

/**
 * A route's photos: the ones it already has, and new ones, each uploaded with
 * `uploadPhoto` as soon as it's added.
 */
export function usePhotoUploads(
  uploadPhoto: UploadPhoto,
  initialPhotos: readonly RouteImage[] = [],
) {
  const [{ photos, announcement }, dispatch] = useReducer(
    reducer,
    initialPhotos,
    (images): State => ({
      photos: images.map(({ cid, url, alt }) => ({
        id: cid,
        previewUrl: url,
        alt,
        status: { state: "saved", cid },
      })),
      announcement: "",
    }),
  );
  const previewUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  function add(files: File[]) {
    const room = Math.max(ROUTE_MAX_IMAGES - photos.length, 0);
    const added = files.slice(0, room).map((file) => {
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.add(previewUrl);
      const photo: Photo = {
        id: crypto.randomUUID(),
        previewUrl,
        alt: "",
        status: { state: "uploading" },
      };
      return { file, photo };
    });
    dispatch({
      type: "added",
      photos: added.map(({ photo }) => photo),
      ignored: files.length - added.length,
    });

    for (const { file, photo } of added) {
      upload(uploadPhoto, photo.id, file).then(dispatch);
    }
  }

  function remove(id: string) {
    const photo = photos.find((photo) => photo.id === id);
    // Saved photos are previewed from the server, not an object URL.
    if (photo && previewUrls.current.has(photo.previewUrl)) {
      URL.revokeObjectURL(photo.previewUrl);
      previewUrls.current.delete(photo.previewUrl);
    }
    dispatch({ type: "removed", id });
  }

  function setAlt(id: string, alt: string) {
    dispatch({ type: "alt-changed", id, alt });
  }

  return {
    photos,
    uploading: photos.some(({ status }) => status.state === "uploading"),
    announcement,
    add,
    remove,
    setAlt,
  };
}

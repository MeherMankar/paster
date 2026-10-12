import "server-only";
import { cache } from "react";
import { peekPaste, viewPaste } from "./service";

/** Deduped per request so generateMetadata and the page share one read. */
export const getView = cache((id: string) => viewPaste(id));
export const getPeek = cache((id: string) => peekPaste(id));

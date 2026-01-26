"use client";

import { useEffect } from "react";
import { setupUpdateManager } from "@/lib/pwa/updateManager";

export default function UpdateManager() {
  useEffect(() => setupUpdateManager(), []);
  return null;
}

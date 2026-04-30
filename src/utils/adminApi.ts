import { supabase } from "../supabaseClient";
import {
  AdminActionResult,
  AdminOverview,
  AdminUserDetail,
  AdminUsersResponse,
} from "../types/types";

type AdminDashboardPayload =
  | { action: "overview" }
  | { action: "users"; search?: string; page?: number; pageSize?: number }
  | { action: "user_detail"; userId: string }
  | { action: "delete_suggestion"; suggestionId: number }
  | { action: "set_admin_role"; userId: string; isAdmin: boolean };

async function invokeAdminDashboard<T>(body: AdminDashboardPayload) {
  const { data, error } = await supabase.functions.invoke("admin-dashboard", { body });

  if (error) {
    return { ok: false, error: error.message } as AdminActionResult<T>;
  }

  return (data || { ok: false, error: "Risposta admin non valida." }) as AdminActionResult<T>;
}

export function fetchAdminOverview() {
  return invokeAdminDashboard<AdminOverview>({ action: "overview" });
}

export function fetchAdminUsers(search = "", page = 1, pageSize = 12) {
  return invokeAdminDashboard<AdminUsersResponse>({
    action: "users",
    search,
    page,
    pageSize,
  });
}

export function fetchAdminUserDetail(userId: string) {
  return invokeAdminDashboard<AdminUserDetail>({ action: "user_detail", userId });
}

export function deleteAdminSuggestion(suggestionId: number) {
  return invokeAdminDashboard<{ suggestionId: number }>({
    action: "delete_suggestion",
    suggestionId,
  });
}

export function setAdminRole(userId: string, isAdmin: boolean) {
  return invokeAdminDashboard<{ userId: string; isAdmin: boolean }>({
    action: "set_admin_role",
    userId,
    isAdmin,
  });
}

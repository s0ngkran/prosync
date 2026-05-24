import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import {
  agencies,
  users,
  fiscalYears,
  documents,
  dikaVouchers,
  plans,
  provinces,
  orgUnits,
  userAssignments,
  roles,
  workflows,
  bankAccounts,
  vendors,
  approvals,
} from "$lib/server/db/schema";
import { eq, and, count, isNull, desc, sql, asc } from "drizzle-orm";
import type { ChartData } from "$lib/types/dashboard";

export const load: PageServerLoad = async ({ parent, url, cookies }) => {
  const { user } = await parent();

  // Get scope from cookies (not URL params)
  const { getAgencyScope, getProvinceScope } = await import("$lib/server/auth/scope");
  const scopeAgencyId = getAgencyScope(user, cookies);
  const scopeProvinceId = getProvinceScope(user, cookies);

  let provinceId = scopeProvinceId ? String(scopeProvinceId) : null;
  let agencyId = scopeAgencyId ? String(scopeAgencyId) : null;
  const orgUnitId = url.searchParams.get("org_unit_id");

  // Load provinces for selector
  const provincesList = await db
    .select()
    .from(provinces)
    .orderBy(provinces.name);

  // Load agencies (filtered by province if selected)
  const agenciesList = provinceId
    ? await db
        .select()
        .from(agencies)
        .where(eq(agencies.province_id, parseInt(provinceId)))
    : await db.select().from(agencies);

  // Load org units (filtered by agency if selected)
  const orgUnitsList = agencyId
    ? await db
        .select()
        .from(orgUnits)
        .where(eq(orgUnits.agency_id, parseInt(agencyId)))
    : await db.select().from(orgUnits);

  const stats: Record<string, unknown> = {};
  const chartData: Record<string, unknown> = {};

  // Determine effective agency_id
  const effectiveAgencyId = agencyId ? parseInt(agencyId) : null;
  // Non-super-admin always has scope auto-selected; super admin needs to pick
  const hasScopeSelected = !user.is_super_admin
    ? true
    : !!(provinceId && agencyId);

  if (hasScopeSelected && effectiveAgencyId) {
    // ═══════════════════════════════════════════
    // KPI STATS
    // ═══════════════════════════════════════════

    // ── Agency-level user count ──
    const [agencyUserCount] = await db
      .select({ count: count() })
      .from(users)
      .where(
        and(
          eq(users.agency_id, effectiveAgencyId),
          isNull(users.deleted_at),
        ),
      );
    stats.agencyUsers = agencyUserCount.count;

    // ── Agency org units count ──
    const [orgUnitCount] = await db
      .select({ count: count() })
      .from(orgUnits)
      .where(eq(orgUnits.agency_id, effectiveAgencyId));
    stats.agencyOrgUnits = orgUnitCount.count;

    // ── Active fiscal year ──
    const [activeFy] = await db
      .select()
      .from(fiscalYears)
      .where(
        and(
          eq(fiscalYears.agency_id, effectiveAgencyId),
          eq(fiscalYears.is_active, true),
        ),
      );

    if (activeFy) {
      stats.fiscalYear = activeFy;
    }

    // ── Active documents count ──
    const [activeDocCount] = await db
      .select({ count: count() })
      .from(documents)
      .where(
        and(
          eq(documents.agency_id, effectiveAgencyId),
          eq(documents.status, "IN_PROGRESS"),
        ),
      );
    stats.activeDocuments = activeDocCount.count;

    // ── Total documents count ──
    const [totalDocCount] = await db
      .select({ count: count() })
      .from(documents)
      .where(eq(documents.agency_id, effectiveAgencyId));
    stats.totalDocuments = totalDocCount.count;

    // ── Pending dika vouchers ──
    const [pendingDika] = await db
      .select({ count: count() })
      .from(dikaVouchers)
      .where(
        and(
          eq(dikaVouchers.agency_id, effectiveAgencyId),
          eq(dikaVouchers.status, "PENDING_EXAMINE"),
        ),
      );
    stats.pendingDikaVouchers = pendingDika.count;

    // ── Total plans count ──
    const [totalPlanCount] = await db
      .select({ count: count() })
      .from(plans)
      .where(eq(plans.agency_id, effectiveAgencyId));
    stats.totalPlans = totalPlanCount.count;

    // ── Completed documents (COMPLETED + APPROVED) ──
    const [completedDocCount] = await db
      .select({ count: count() })
      .from(documents)
      .where(
        and(
          eq(documents.agency_id, effectiveAgencyId),
          sql`${documents.status} IN ('COMPLETED', 'APPROVED')`,
        ),
      );
    stats.completedDocuments = completedDocCount.count;

    // ── Total dika vouchers count ──
    const [totalDikaCount] = await db
      .select({ count: count() })
      .from(dikaVouchers)
      .where(eq(dikaVouchers.agency_id, effectiveAgencyId));
    stats.totalDikaVouchers = totalDikaCount.count;

    // ── Paid dika vouchers ──
    const [paidDikaCount] = await db
      .select({ count: count() })
      .from(dikaVouchers)
      .where(
        and(
          eq(dikaVouchers.agency_id, effectiveAgencyId),
          eq(dikaVouchers.status, "PAID"),
        ),
      );
    stats.paidDikaVouchers = paidDikaCount.count;

    // ═══════════════════════════════════════════
    // CHART DATA
    // ═══════════════════════════════════════════

    // ── 1. Document status breakdown ──
    const agencyDocStatus = await db
      .select({
        status: documents.status,
        count: count(),
      })
      .from(documents)
      .where(eq(documents.agency_id, effectiveAgencyId))
      .groupBy(documents.status);

    chartData.documentStatus = agencyDocStatus.map((d) => ({
      label: getStatusLabel(d.status),
      value: d.count,
      color: getStatusColor(d.status),
    }));

    // ── 2. Dika voucher status breakdown ──
    const agencyDikaStatus = await db
      .select({
        status: dikaVouchers.status,
        count: count(),
      })
      .from(dikaVouchers)
      .where(eq(dikaVouchers.agency_id, effectiveAgencyId))
      .groupBy(dikaVouchers.status);

    chartData.dikaStatus = agencyDikaStatus.map((d) => ({
      label: getDikaStatusLabel(d.status),
      value: d.count,
      color: getDikaStatusColor(d.status),
    }));

    // ── 3. Plan type breakdown (income vs expense) ──
    const agencyPlanType = await db
      .select({
        planType: plans.plan_type,
        count: count(),
      })
      .from(plans)
      .where(eq(plans.agency_id, effectiveAgencyId))
      .groupBy(plans.plan_type);

    chartData.planType = agencyPlanType.map((p) => ({
      label: p.planType === "INCOME" ? "รายได้" : "รายจ่าย",
      value: p.count,
      color:
        p.planType === "INCOME"
          ? "oklch(0.54 0.16 150)"
          : "oklch(0.52 0.14 240)",
    }));

    // ── 4. Budget summary (aggregate all leaf plans) ──
    const budgetSummary = await db
      .select({
        plan_type: plans.plan_type,
        total_estimated: sql<number>`COALESCE(SUM(${plans.estimated_amount}), 0)`,
        total_actual: sql<number>`COALESCE(SUM(${plans.actual_amount}), 0)`,
      })
      .from(plans)
      .where(
        and(
          eq(plans.agency_id, effectiveAgencyId),
          eq(plans.is_leaf_node, true),
        ),
      )
      .groupBy(plans.plan_type);

    const incomeSummary = budgetSummary.find((b) => b.plan_type === "INCOME");
    const expenseSummary = budgetSummary.find(
      (b) => b.plan_type === "EXPENSE",
    );

    chartData.budgetSummary = {
      income: {
        estimated: Number(incomeSummary?.total_estimated) || 0,
        actual: Number(incomeSummary?.total_actual) || 0,
      },
      expense: {
        estimated: Number(expenseSummary?.total_estimated) || 0,
        actual: Number(expenseSummary?.total_actual) || 0,
      },
    };

    // ── 5. Budget by org unit (top 8) ──
    const budgetByUnit = await db
      .select({
        unit_name: orgUnits.name,
        plan_type: plans.plan_type,
        total_budget: sql<number>`SUM(${plans.estimated_amount})`,
        used_budget: sql<number>`SUM(${plans.actual_amount})`,
      })
      .from(plans)
      .innerJoin(orgUnits, eq(plans.responsible_unit_id, orgUnits.id))
      .where(
        and(
          eq(plans.agency_id, effectiveAgencyId),
          eq(plans.is_leaf_node, true),
        ),
      )
      .groupBy(orgUnits.name, plans.plan_type)
      .orderBy(desc(sql`SUM(${plans.estimated_amount})`))
      .limit(8);

    const incomeByUnit = budgetByUnit
      .filter((b) => b.plan_type === "INCOME")
      .map((b) => {
        const used = Number(b.used_budget) || 0;
        const total = Number(b.total_budget) || 1;
        return {
          label: b.unit_name,
          value: used,
          max: total,
          color: "oklch(0.54 0.16 150)",
        };
      });

    const expenseByUnit = budgetByUnit
      .filter((b) => b.plan_type === "EXPENSE")
      .map((b) => {
        const used = Number(b.used_budget) || 0;
        const total = Number(b.total_budget) || 1;
        const isOver = used > total;
        return {
          label: b.unit_name,
          value: used,
          max: total,
          color: isOver ? "oklch(0.58 0.2 25)" : "oklch(0.52 0.14 240)",
        };
      });

    chartData.budgetByUnitIncome = incomeByUnit;
    chartData.budgetByUnitExpense = expenseByUnit;

    // ── 6. Staff by role (bar chart) ──
    const staffByRole = await db
      .select({
        role_name: roles.name,
        count: count(),
      })
      .from(userAssignments)
      .innerJoin(roles, eq(userAssignments.role_id, roles.id))
      .innerJoin(users, eq(userAssignments.user_id, users.id))
      .where(
        and(
          eq(users.agency_id, effectiveAgencyId),
          isNull(users.deleted_at),
        ),
      )
      .groupBy(roles.name)
      .orderBy(desc(count()));

    const roleColors = [
      "oklch(0.52 0.14 240)",
      "oklch(0.54 0.16 150)",
      "oklch(0.62 0.18 60)",
      "oklch(0.58 0.2 25)",
      "oklch(0.55 0.12 280)",
      "oklch(0.5 0.14 200)",
      "oklch(0.6 0.1 340)",
      "oklch(0.48 0.12 220)",
    ];

    chartData.staffByRole = staffByRole.map((s, i) => ({
      label: s.role_name,
      value: s.count,
      color: roleColors[i % roleColors.length],
    }));

    // ── 7. Documents by workflow type ──
    const docsByWorkflow = await db
      .select({
        workflow_name: workflows.name,
        count: count(),
      })
      .from(documents)
      .innerJoin(workflows, eq(documents.workflow_id, workflows.id))
      .where(eq(documents.agency_id, effectiveAgencyId))
      .groupBy(workflows.name)
      .orderBy(desc(count()));

    chartData.docsByWorkflow = docsByWorkflow.map((d) => ({
      label: d.workflow_name,
      value: d.count,
      color: "oklch(0.52 0.14 240)",
    }));

    // ── 8. Top parent plans by budget ──
    const topParentPlans = await db
      .select({
        title: plans.title,
        plan_type: plans.plan_type,
        estimated_amount: plans.estimated_amount,
        actual_amount: plans.actual_amount,
      })
      .from(plans)
      .where(
        and(
          eq(plans.agency_id, effectiveAgencyId),
          sql`${plans.parent_id} IS NULL`,
        ),
      )
      .orderBy(desc(plans.estimated_amount))
      .limit(6);

    chartData.topParentPlans = topParentPlans.map((p) => {
      const estimated = Number(p.estimated_amount) || 0;
      const actual = Number(p.actual_amount) || 0;
      return {
        label: p.title,
        value: actual,
        max: estimated,
        color:
          p.plan_type === "INCOME"
            ? "oklch(0.54 0.16 150)"
            : "oklch(0.52 0.14 240)",
      };
    });

    // ── 9. Dika voucher amounts by status ──
    const dikaAmountsByStatus = await db
      .select({
        status: dikaVouchers.status,
        total_gross: sql<number>`COALESCE(SUM(${dikaVouchers.gross_amount}), 0)`,
        total_net: sql<number>`COALESCE(SUM(${dikaVouchers.net_amount}), 0)`,
        total_tax: sql<number>`COALESCE(SUM(${dikaVouchers.tax_amount}), 0)`,
        count: count(),
      })
      .from(dikaVouchers)
      .where(eq(dikaVouchers.agency_id, effectiveAgencyId))
      .groupBy(dikaVouchers.status);

    chartData.dikaAmounts = dikaAmountsByStatus.map((d) => ({
      status: d.status,
      label: getDikaStatusLabel(d.status),
      grossAmount: Number(d.total_gross) || 0,
      netAmount: Number(d.total_net) || 0,
      taxAmount: Number(d.total_tax) || 0,
      count: d.count,
      color: getDikaStatusColor(d.status),
    }));

    // Total dika amounts
    const totalDikaGross = dikaAmountsByStatus.reduce(
      (sum, d) => sum + (Number(d.total_gross) || 0),
      0,
    );
    const totalDikaTax = dikaAmountsByStatus.reduce(
      (sum, d) => sum + (Number(d.total_tax) || 0),
      0,
    );
    const totalDikaNet = dikaAmountsByStatus.reduce(
      (sum, d) => sum + (Number(d.total_net) || 0),
      0,
    );
    stats.totalDikaGross = totalDikaGross;
    stats.totalDikaTax = totalDikaTax;
    stats.totalDikaNet = totalDikaNet;

    // ── 10. Bank account balances ──
    const bankBalances = await db
      .select({
        account_name: bankAccounts.account_name,
        account_number: bankAccounts.account_number,
        balance: bankAccounts.balance,
        is_tax_pool: bankAccounts.is_tax_pool,
      })
      .from(bankAccounts)
      .where(eq(bankAccounts.agency_id, effectiveAgencyId))
      .orderBy(desc(bankAccounts.balance));

    chartData.bankBalances = bankBalances.map((b) => ({
      name: b.account_name,
      number: b.account_number,
      balance: Number(b.balance) || 0,
      isTaxPool: b.is_tax_pool,
    }));

    // ── 11. Top vendors by dika amount ──
    const topVendors = await db
      .select({
        vendor_name: vendors.company_name,
        vendor_type: vendors.vendor_type,
        total_amount: sql<number>`COALESCE(SUM(${dikaVouchers.gross_amount}), 0)`,
        voucher_count: count(),
      })
      .from(dikaVouchers)
      .innerJoin(vendors, eq(dikaVouchers.vendor_id, vendors.id))
      .where(eq(dikaVouchers.agency_id, effectiveAgencyId))
      .groupBy(vendors.company_name, vendors.vendor_type)
      .orderBy(desc(sql`SUM(${dikaVouchers.gross_amount})`))
      .limit(5);

    chartData.topVendors = topVendors.map((v) => ({
      name: v.vendor_name,
      type: v.vendor_type,
      amount: Number(v.total_amount) || 0,
      count: v.voucher_count,
    }));

    // ── 12. Approval stats ──
    const approvalStats = await db
      .select({
        action: approvals.action,
        count: count(),
      })
      .from(approvals)
      .innerJoin(documents, eq(approvals.document_id, documents.id))
      .where(eq(documents.agency_id, effectiveAgencyId))
      .groupBy(approvals.action);

    chartData.approvalStats = approvalStats.map((a) => ({
      label: a.action === "APPROVED" ? "อนุมัติ" : "ไม่อนุมัติ",
      value: a.count,
      color:
        a.action === "APPROVED"
          ? "oklch(0.54 0.16 150)"
          : "oklch(0.58 0.2 25)",
    }));

    // ── 13. Plan execution rate (leaf plans with actual > 0) ──
    const [planExecution] = await db
      .select({
        total: count(),
        started: sql<number>`COUNT(CASE WHEN ${plans.actual_amount} > 0 THEN 1 END)`,
      })
      .from(plans)
      .where(
        and(
          eq(plans.agency_id, effectiveAgencyId),
          eq(plans.is_leaf_node, true),
        ),
      );

    stats.planExecutionRate = {
      total: planExecution.total,
      started: Number(planExecution.started) || 0,
      percentage:
        planExecution.total > 0
          ? (
              ((Number(planExecution.started) || 0) / planExecution.total) *
              100
            ).toFixed(1)
          : "0.0",
    };
  }

  // Get the selected agency name for display
  let selectedAgencyName: string | null = null;
  if (effectiveAgencyId) {
    const found = agenciesList.find((a) => a.id === effectiveAgencyId);
    selectedAgencyName = found?.name ?? null;
  }

  stats.systemStatus = "online";

  return {
    user,
    stats,
    chartData,
    provinces: provincesList,
    agencies: agenciesList,
    orgUnits: orgUnitsList,
    selectedAgencyName,
    filters: {
      provinceId: provinceId ? parseInt(provinceId) : null,
      agencyId: effectiveAgencyId,
      orgUnitId: orgUnitId ? parseInt(orgUnitId) : null,
    },
  };
};

// Helper functions
function getStatusLabel(status: string | null): string {
  const labels: Record<string, string> = {
    DRAFT: "ร่าง",
    IN_PROGRESS: "ดำเนินการ",
    COMPLETED: "เสร็จสิ้น",
    CANCELLED: "ยกเลิก",
    PENDING: "รอดำเนินการ",
    APPROVED: "อนุมัติ",
    REJECTED: "ไม่อนุมัติ",
  };
  return labels[status || ""] || status || "ไม่ระบุ";
}

function getStatusColor(status: string | null): string {
  const colors: Record<string, string> = {
    DRAFT: "oklch(0.6 0.02 180)",
    IN_PROGRESS: "oklch(0.52 0.14 240)",
    COMPLETED: "oklch(0.54 0.16 150)",
    CANCELLED: "oklch(0.58 0.2 25)",
    PENDING: "oklch(0.62 0.18 60)",
    APPROVED: "oklch(0.54 0.16 150)",
    REJECTED: "oklch(0.58 0.2 25)",
  };
  return colors[status || ""] || "oklch(0.6 0.02 180)";
}

function getDikaStatusLabel(status: string | null): string {
  const labels: Record<string, string> = {
    DRAFT: "ร่าง",
    PENDING_EXAMINE: "รอตรวจสอบ",
    EXAMINED: "ตรวจสอบแล้ว",
    APPROVED: "อนุมัติ",
    REJECTED: "ไม่อนุมัติ",
    PAID: "จ่ายแล้ว",
  };
  return labels[status || ""] || status || "ไม่ระบุ";
}

function getDikaStatusColor(status: string | null): string {
  const colors: Record<string, string> = {
    DRAFT: "oklch(0.6 0.02 180)",
    PENDING_EXAMINE: "oklch(0.62 0.18 60)",
    EXAMINED: "oklch(0.52 0.14 240)",
    APPROVED: "oklch(0.54 0.16 150)",
    REJECTED: "oklch(0.58 0.2 25)",
    PAID: "oklch(0.54 0.16 150)",
  };
  return colors[status || ""] || "oklch(0.6 0.02 180)";
}

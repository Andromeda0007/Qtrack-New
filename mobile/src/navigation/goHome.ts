/**
 * After completing scan-driven flows (QC, issue to production, QA on FG),
 * reset the root stack to Main with the Home (Dashboard) tab active.
 * Avoids landing back on Scanner with stale batch actions.
 */
export function resetToDashboardHome(navigation: {
  reset: (state: {
    index: number;
    routes: Array<{ name: string; state?: { routes: Array<{ name: string }>; index: number } }>;
  }) => void;
}): void {
  navigation.reset({
    index: 0,
    routes: [
      {
        name: "Main",
        state: {
          routes: [{ name: "Dashboard" }],
          index: 0,
        },
      },
    ],
  });
}

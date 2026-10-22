export function activityLabel(activity: string): string {
  switch (activity) {
    case "app.attrails.v0.defs#cycling":
      return "Cycling";
    case "app.attrails.v0.defs#running":
      return "Running";
    case "app.attrails.v0.defs#hiking":
      return "Hiking";
    case "app.attrails.v0.defs#walking":
      return "Walking";
    default:
      return "Other";
  }
}

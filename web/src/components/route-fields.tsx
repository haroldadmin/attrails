import type { Option } from "@/lib/labels";
import type { RouteValues } from "@/lib/route-form";

export type RouteFieldsProps = {
  values: RouteValues;
  activities: readonly Option[];
  surfaces: readonly Option[];
  difficulties: readonly Option[];
};

export function RouteFields({
  values,
  activities,
  surfaces,
  difficulties,
}: RouteFieldsProps) {
  return (
    <>
      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className="input w-full"
          maxLength={100}
          defaultValue={values.name}
          required
        />
      </fieldset>

      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor="description">
          Description <span className="font-normal">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          className="textarea w-full"
          rows={4}
          maxLength={3000}
          defaultValue={values.description}
        />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <fieldset className="fieldset">
          <label className="fieldset-legend" htmlFor="activity">
            Activity
          </label>
          <select
            id="activity"
            name="activity"
            className="select w-full"
            defaultValue={values.activity}
            required
          >
            {activities.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="fieldset">
          <label className="fieldset-legend" htmlFor="surface">
            Surface <span className="font-normal">(optional)</span>
          </label>
          <select
            id="surface"
            name="surface"
            className="select w-full"
            defaultValue={values.surface}
          >
            <option value="">Not specified</option>
            {surfaces.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="fieldset">
          <label className="fieldset-legend" htmlFor="difficulty">
            Difficulty <span className="font-normal">(optional)</span>
          </label>
          <select
            id="difficulty"
            name="difficulty"
            className="select w-full"
            defaultValue={values.difficulty}
          >
            <option value="">Not specified</option>
            {difficulties.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </fieldset>
      </div>

      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor="tags">
          Tags <span className="font-normal">(optional)</span>
        </label>
        <input
          id="tags"
          name="tags"
          type="text"
          className="input w-full"
          placeholder="coastal, cafe stop"
          defaultValue={values.tags}
        />
        <p className="label">Separate tags with commas.</p>
      </fieldset>
    </>
  );
}

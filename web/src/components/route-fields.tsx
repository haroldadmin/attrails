import type { Option } from "@/lib/labels";
import type { RouteValues } from "@/lib/route-form";
import { TagInput } from "./tag-input";

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
          aria-describedby="name-hint"
          required
        />
        <p id="name-hint" className="label whitespace-normal">
          A short name people will recognise, like where the route starts or
          what it passes.
        </p>
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
          aria-describedby="description-hint"
        />
        <p id="description-hint" className="label whitespace-normal">
          What makes the route worth doing: highlights, places to stop, and
          anything to watch out for.
        </p>
      </fieldset>

      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor="activity">
          Activity
        </label>
        <select
          id="activity"
          name="activity"
          className="select w-full"
          defaultValue={values.activity}
          aria-describedby="activity-hint"
          required
        >
          <option value="" disabled>
            Choose an activity
          </option>
          {activities.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p id="activity-hint" className="label whitespace-normal">
          What activity the route is best suited to.
        </p>
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
          aria-describedby="surface-hint"
        >
          <option value="">Not specified</option>
          {surfaces.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p id="surface-hint" className="label whitespace-normal">
          What most of the route is on.
        </p>
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
          aria-describedby="difficulty-hint"
        >
          <option value="">Not specified</option>
          {difficulties.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p id="difficulty-hint" className="label whitespace-normal">
          How demanding the route is for someone who does this activity
          regularly.
        </p>
      </fieldset>

      <fieldset className="fieldset">
        <label className="fieldset-legend" htmlFor="tags">
          Tags <span className="font-normal">(optional)</span>
        </label>
        <TagInput
          id="tags"
          name="tags"
          placeholder="coastal, cafe stop"
          defaultValue={values.tags}
          aria-describedby="tags-hint"
        />
        <p id="tags-hint" className="label whitespace-normal">
          Words people might search for. Press Enter or type a comma after each
          one.
        </p>
      </fieldset>
    </>
  );
}

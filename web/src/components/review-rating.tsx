const RATINGS = [1, 2, 3, 4, 5];

export type ReviewRatingProps = {
  rating: number;
};

export function ReviewRating({ rating }: ReviewRatingProps) {
  return (
    <div
      role="img"
      aria-label={`Rated ${rating} out of 5`}
      className="rating rating-sm"
    >
      {RATINGS.map((value) => (
        <div
          key={value}
          className="mask mask-star-2 bg-warning"
          aria-current={value === rating}
        />
      ))}
    </div>
  );
}

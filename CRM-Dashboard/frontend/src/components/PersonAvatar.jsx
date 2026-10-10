// PersonAvatar.jsx — Round photo if the person has one, otherwise their initials on the brand gradient.
const initials = (name = "") =>
  name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";

export default function PersonAvatar({ person, name, size = 28 }) {
  const label = person?.name || name || "";
  const box = { width: size, height: size };
  return person?.photo ? (
    <img src={person.photo} alt="" title={label} style={box} className="flex-shrink-0 rounded-full object-cover ring-2 ring-white" />
  ) : (
    <span
      title={label}
      style={{ ...box, fontSize: Math.round(size * 0.36) }}
      className="inline-flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 font-bold text-white ring-2 ring-white"
    >
      {initials(label)}
    </span>
  );
}

interface Props {
  text: string;
  variant: "highlight" | "warning" | "info" | "strategy";
}

const styles: Record<Props["variant"], string> = {
  highlight: "bg-green-50 text-green-700 border-green-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  strategy: "bg-purple-50 text-purple-700 border-purple-200",
};

export default function Badge({ text, variant }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${styles[variant]}`}
    >
      {text}
    </span>
  );
}

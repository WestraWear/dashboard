export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-background px-4">
      {children}
    </div>
  );
}

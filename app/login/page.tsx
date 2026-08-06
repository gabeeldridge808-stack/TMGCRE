import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="page page-narrow" style={{ paddingTop: 96 }}>
      <h1 style={{ marginBottom: 24, textAlign: "center" }}>Deal Tracker</h1>
      <LoginForm next={params?.next ?? "/"} />
    </main>
  );
}

type RegisterPageProps = {
  params: Promise<{
    branchToken: string;
  }>;
};

export default async function RegisterPage({ params }: RegisterPageProps) {
  const { branchToken } = await params;

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Registro público</p>
        <h1 className="title">Alta por sucursal.</h1>
        <p className="body-copy">
          Token de sucursal recibido: <strong>{branchToken}</strong>.
        </p>
      </section>
    </main>
  );
}


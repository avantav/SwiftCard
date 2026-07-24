type CardPageProps = {
  params: Promise<{
    cardToken: string;
  }>;
};

export default async function CardPage({ params }: CardPageProps) {
  const { cardToken } = await params;

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Web Card</p>
        <h1 className="title">Tarjeta digital.</h1>
        <p className="body-copy">
          Token público recibido: <strong>{cardToken}</strong>.
        </p>
      </section>
    </main>
  );
}


import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8 text-center">
        Welcome to QuantFlash
      </h1>
      <p className="text-lg text-gray-600 mb-8 text-center max-w-md">
        Master quant finance concepts with spaced repetition flashcards
      </p>
      <Link 
        href="/study"
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
      >
        Start Studying
      </Link>
    </div>
  )
}
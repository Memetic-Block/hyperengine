function greet(name: string): string {
  return `Hello, ${name}!`
}

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('greeting')
  if (el) {
    el.textContent = greet('World')
  }
})

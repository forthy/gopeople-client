import { Greeter } from '../index'

test('should greet', () => {
  expect(Greeter('Carl')).toBe('Hello Carl')
})
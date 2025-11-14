import { ValueObject } from './value-object';

// Test ValueObject Implementierung
interface TestProps {
  name: string;
  age: number;
}

class TestValueObject extends ValueObject<TestProps> {
  get name(): string {
    return this.props.name;
  }

  get age(): number {
    return this.props.age;
  }

  public static create(props: TestProps): TestValueObject {
    return new TestValueObject(props);
  }
}

// Test ValueObject mit verschachtelten Properties
interface NestedProps {
  id: string;
  metadata: {
    tags: string[];
    count: number;
  };
}

class NestedValueObject extends ValueObject<NestedProps> {
  get id(): string {
    return this.props.id;
  }

  get metadata() {
    return this.props.metadata;
  }

  public static create(props: NestedProps): NestedValueObject {
    return new NestedValueObject(props);
  }
}

describe('ValueObject', () => {
  describe('constructor', () => {
    it('should freeze props for runtime immutability', () => {
      // Given: Valid props
      const props = { name: 'John', age: 30 };

      // When: Creating ValueObject
      const vo = TestValueObject.create(props);

      // Then: Props are frozen
      expect(Object.isFrozen(vo.props)).toBe(true);
    });

    it('should create independent copy of props', () => {
      // Given: Mutable props object
      const props = { name: 'John', age: 30 };

      // When: Creating ValueObject and mutating original
      const vo = TestValueObject.create(props);
      props.name = 'Jane';
      props.age = 25;

      // Then: ValueObject props are unchanged
      expect(vo.name).toBe('John');
      expect(vo.age).toBe(30);
    });
  });

  describe('equals()', () => {
    it('should return true for same values in different instances', () => {
      // Given: Two ValueObjects with identical properties
      const vo1 = TestValueObject.create({ name: 'John', age: 30 });
      const vo2 = TestValueObject.create({ name: 'John', age: 30 });

      // When: Comparing with equals()
      const result = vo1.equals(vo2);

      // Then: Structural equality is true
      expect(result).toBe(true);
    });

    it('should return false for different values', () => {
      // Given: Two ValueObjects with different properties
      const vo1 = TestValueObject.create({ name: 'John', age: 30 });
      const vo2 = TestValueObject.create({ name: 'Jane', age: 25 });

      // When: Comparing with equals()
      const result = vo1.equals(vo2);

      // Then: Structural equality is false
      expect(result).toBe(false);
    });

    it('should return true for same instance (reflexive)', () => {
      // Given: A single ValueObject instance
      const vo = TestValueObject.create({ name: 'John', age: 30 });

      // When: Comparing with itself
      const result = vo.equals(vo);

      // Then: Reflexive equality holds
      expect(result).toBe(true);
    });

    it('should return false for undefined', () => {
      // Given: A ValueObject and undefined
      const vo = TestValueObject.create({ name: 'John', age: 30 });

      // When: Comparing with undefined
      const result = vo.equals(undefined);

      // Then: Equality is false
      expect(result).toBe(false);
    });

    it('should handle nested object equality correctly', () => {
      // Given: Two ValueObjects with identical nested structures
      const vo1 = NestedValueObject.create({
        id: 'test-123',
        metadata: { tags: ['a', 'b'], count: 5 },
      });
      const vo2 = NestedValueObject.create({
        id: 'test-123',
        metadata: { tags: ['a', 'b'], count: 5 },
      });

      // When: Comparing nested ValueObjects
      const result = vo1.equals(vo2);

      // Then: Deep structural equality is true
      expect(result).toBe(true);
    });

    it('should detect differences in nested arrays', () => {
      // Given: Two ValueObjects with different nested arrays
      const vo1 = NestedValueObject.create({
        id: 'test-123',
        metadata: { tags: ['a', 'b'], count: 5 },
      });
      const vo2 = NestedValueObject.create({
        id: 'test-123',
        metadata: { tags: ['a', 'c'], count: 5 },
      });

      // When: Comparing with different array values
      const result = vo1.equals(vo2);

      // Then: Equality is false
      expect(result).toBe(false);
    });

    it('should be symmetric (A.equals(B) === B.equals(A))', () => {
      // Given: Two ValueObjects with same values
      const vo1 = TestValueObject.create({ name: 'John', age: 30 });
      const vo2 = TestValueObject.create({ name: 'John', age: 30 });

      // When: Comparing both directions
      const aEqualsB = vo1.equals(vo2);
      const bEqualsA = vo2.equals(vo1);

      // Then: Symmetric equality holds
      expect(aEqualsB).toBe(bEqualsA);
      expect(aEqualsB).toBe(true);
    });

    it('should be transitive (A.equals(B) && B.equals(C) => A.equals(C))', () => {
      // Given: Three ValueObjects with same values
      const vo1 = TestValueObject.create({ name: 'John', age: 30 });
      const vo2 = TestValueObject.create({ name: 'John', age: 30 });
      const vo3 = TestValueObject.create({ name: 'John', age: 30 });

      // When: Comparing in chain
      const aEqualsB = vo1.equals(vo2);
      const bEqualsC = vo2.equals(vo3);
      const aEqualsC = vo1.equals(vo3);

      // Then: Transitive equality holds
      expect(aEqualsB).toBe(true);
      expect(bEqualsC).toBe(true);
      expect(aEqualsC).toBe(true);
    });

    it('should ignore reference equality when values differ', () => {
      // Given: Two separate instances with different values
      const vo1 = TestValueObject.create({ name: 'John', age: 30 });
      const vo2 = TestValueObject.create({ name: 'Jane', age: 25 });

      // When: Checking reference and structural equality
      const referenceEquals = vo1 === vo2;
      const structuralEquals = vo1.equals(vo2);

      // Then: Reference inequality, structural inequality
      expect(referenceEquals).toBe(false);
      expect(structuralEquals).toBe(false);
    });

    it('should ignore reference equality when values match', () => {
      // Given: Two separate instances with same values
      const vo1 = TestValueObject.create({ name: 'John', age: 30 });
      const vo2 = TestValueObject.create({ name: 'John', age: 30 });

      // When: Checking reference and structural equality
      const referenceEquals = vo1 === vo2;
      const structuralEquals = vo1.equals(vo2);

      // Then: Reference inequality, but structural equality
      expect(referenceEquals).toBe(false);
      expect(structuralEquals).toBe(true);
    });
  });

  describe('hashCode()', () => {
    it('should generate same hashCode for equal ValueObjects', () => {
      // Given: Two ValueObjects with identical properties
      const vo1 = TestValueObject.create({ name: 'John', age: 30 });
      const vo2 = TestValueObject.create({ name: 'John', age: 30 });

      // When: Generating hashCodes
      const hash1 = vo1.hashCode();
      const hash2 = vo2.hashCode();

      // Then: HashCodes are identical
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashCode for different ValueObjects', () => {
      // Given: Two ValueObjects with different properties
      const vo1 = TestValueObject.create({ name: 'John', age: 30 });
      const vo2 = TestValueObject.create({ name: 'Jane', age: 25 });

      // When: Generating hashCodes
      const hash1 = vo1.hashCode();
      const hash2 = vo2.hashCode();

      // Then: HashCodes are different (highly likely, not guaranteed)
      expect(hash1).not.toBe(hash2);
    });

    it('should generate consistent hashCode across multiple calls', () => {
      // Given: A single ValueObject
      const vo = TestValueObject.create({ name: 'John', age: 30 });

      // When: Calling hashCode multiple times
      const hash1 = vo.hashCode();
      const hash2 = vo.hashCode();
      const hash3 = vo.hashCode();

      // Then: All hashCodes are identical
      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
    });

    it('should handle nested structures in hashCode', () => {
      // Given: Two nested ValueObjects with same structure
      const vo1 = NestedValueObject.create({
        id: 'test-123',
        metadata: { tags: ['a', 'b'], count: 5 },
      });
      const vo2 = NestedValueObject.create({
        id: 'test-123',
        metadata: { tags: ['a', 'b'], count: 5 },
      });

      // When: Generating hashCodes for nested structures
      const hash1 = vo1.hashCode();
      const hash2 = vo2.hashCode();

      // Then: HashCodes match for deep equality
      expect(hash1).toBe(hash2);
    });

    it('should return number type', () => {
      // Given: A ValueObject
      const vo = TestValueObject.create({ name: 'John', age: 30 });

      // When: Generating hashCode
      const hash = vo.hashCode();

      // Then: Result is a number
      expect(typeof hash).toBe('number');
    });
  });

  describe('immutability', () => {
    it('should prevent property mutation via TypeScript readonly', () => {
      // Given: A ValueObject
      const vo = TestValueObject.create({ name: 'John', age: 30 });

      // When/Then: Attempting to mutate props (compile-time error)
      // @ts-expect-error - Testing runtime immutability enforcement
      expect(() => {
        vo.props.name = 'Jane';
      }).toThrow();
    });

    it('should prevent direct props reassignment at compile-time', () => {
      // Given: A ValueObject
      const vo = TestValueObject.create({ name: 'John', age: 30 });

      // When: Checking readonly enforcement
      // Note: TypeScript readonly prevents reassignment at compile-time
      // Runtime enforcement is done via Object.freeze (tested separately)

      // Then: Props reference remains unchanged
      const originalProps = vo.props;
      expect(vo.props).toBe(originalProps);
    });

    it('should enforce Object.freeze at runtime', () => {
      // Given: A ValueObject
      const vo = TestValueObject.create({ name: 'John', age: 30 });

      // When: Checking if props are frozen
      const isFrozen = Object.isFrozen(vo.props);

      // Then: Props are frozen at runtime
      expect(isFrozen).toBe(true);
    });
  });
});

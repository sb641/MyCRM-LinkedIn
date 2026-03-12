# Это демонстрационный тест для проверки pytest в проекте MyCRM-LinkedIn

def test_linkedin_basic_math():
    """
    Проверяет, что базовая арифметика работает правильно.
    """
    assert 5 * 5 == 25

def test_linkedin_string_format():
    """
    Проверяет базовую операцию со строками.
    """
    first_name = "John"
    last_name = "Doe"
    assert f"Hello, {first_name} {last_name}" == "Hello, John Doe"


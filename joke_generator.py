import requests
import json
from typing import Dict, Optional

class JokeGenerator:
    """
    A random joke generator that fetches jokes from external APIs.
    Supports multiple joke sources and formats.
    """
    
    def __init__(self):
        self.joke_api_url = "https://official-joke-api.appspot.com/random_joke"
        self.programming_joke_url = "https://official-joke-api.appspot.com/jokes/programming/random"
        self.knock_knock_url = "https://official-joke-api.appspot.com/jokes/knock-knock/random"
    
    def get_random_joke(self) -> Optional[Dict]:
        """
        Fetch a random joke from the Official Joke API.
        
        Returns:
            dict: A dictionary containing 'setup' and 'punchline' keys, or None on failure
        """
        try:
            response = requests.get(self.joke_api_url, timeout=5)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching joke: {e}")
            return None
    
    def get_programming_joke(self) -> Optional[Dict]:
        """
        Fetch a programming-specific joke.
        
        Returns:
            dict: A dictionary containing 'setup' and 'punchline' keys, or None on failure
        """
        try:
            response = requests.get(self.programming_joke_url, timeout=5)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching programming joke: {e}")
            return None
    
    def get_knock_knock_joke(self) -> Optional[Dict]:
        """
        Fetch a knock-knock joke.
        
        Returns:
            dict: A dictionary containing 'setup' and 'punchline' keys, or None on failure
        """
        try:
            response = requests.get(self.knock_knock_url, timeout=5)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching knock-knock joke: {e}")
            return None
    
    def display_joke(self, joke: Dict) -> None:
        """
        Display a joke in a formatted manner.
        
        Args:
            joke (dict): A joke dictionary with 'setup' and 'punchline' keys
        """
        if joke:
            print("\n" + "="*60)
            print(f"Setup: {joke.get('setup', 'N/A')}")
            print(f"Punchline: {joke.get('punchline', 'N/A')}")
            print("="*60 + "\n")
        else:
            print("Failed to retrieve joke.")
    
    def display_multiple_jokes(self, count: int = 3) -> None:
        """
        Display multiple random jokes.
        
        Args:
            count (int): Number of jokes to display
        """
        print(f"\nGenerating {count} random jokes...\n")
        for i in range(count):
            joke = self.get_random_joke()
            print(f"Joke {i+1}:")
            self.display_joke(joke)


def main():
    """Main function to demonstrate the joke generator."""
    generator = JokeGenerator()
    
    print("🎭 Welcome to the Random Joke Generator! 🎭")
    print("="*60)
    
    # Get a single random joke
    print("\n📢 Fetching a random joke...")
    joke = generator.get_random_joke()
    generator.display_joke(joke)
    
    # Get a programming joke
    print("💻 Fetching a programming joke...")
    prog_joke = generator.get_programming_joke()
    generator.display_joke(prog_joke)
    
    # Get a knock-knock joke
    print("🚪 Fetching a knock-knock joke...")
    kk_joke = generator.get_knock_knock_joke()
    generator.display_joke(kk_joke)
    
    # Display multiple jokes
    generator.display_multiple_jokes(count=3)


if __name__ == "__main__":
    main()

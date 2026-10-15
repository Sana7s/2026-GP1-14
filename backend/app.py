from flask import Flask, jsonify

app = Flask(__name__)


@app.get("/api/hello")
def hello():
    """Confirm that the Flask API is responding."""
    return jsonify(message="Hello from Flask!")


@app.get("/api/health")
def health_check():
    """Provide a simple status check for the backend."""
    return jsonify({"status": "ok", "service": "BurnCare API"})


@app.get("/api/site-content")
def site_content():
    """Send the page text and developer placeholders to the React frontend."""
    return jsonify(
        {
            "brandName": "BurnCare",
            "tagline": "A clearer first step after a burn.",
            "homeTitle": "Support for the first step in burn assessment",
            "homeDescription": (
                "BurnCare is a graduation project exploring how digital tools "
                "can support a preliminary burn assessment and help people "
                "understand possible next steps."
            ),
            "aboutIntro": (
                "BurnCare is a web-based graduation project focused on "
                "supporting an initial burn assessment through accessible "
                "digital tools. It is designed to organize information—not "
                "replace the judgment of a qualified healthcare professional."
            ),
            "vision": "Add the approved BurnCare vision statement here.",
            "mission": "Add the approved BurnCare mission statement here.",
            "developers": [
                {
                    "id": 1,
                    "name": "Team member 01",
                    "role": "Role / specialization",
                    "bio": "Add a short introduction for this team member.",
                },
                {
                    "id": 2,
                    "name": "Team member 02",
                    "role": "Role / specialization",
                    "bio": "Add a short introduction for this team member.",
                },
                {
                    "id": 3,
                    "name": "Team member 03",
                    "role": "Role / specialization",
                    "bio": "Add a short introduction for this team member.",
                },
                {
                    "id": 4,
                    "name": "Team member 04",
                    "role": "Role / specialization",
                    "bio": "Add a short introduction for this team member.",
                },
            ],
        }
    )


if __name__ == "__main__":
    # Start the Flask development server on port 5000.
    app.run(debug=True, port=5000)